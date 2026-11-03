import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageProducts, getTenantContext } from "@/lib/tenant";

const normalizeHeader = (header: string) => header.trim().toLowerCase().replace(/\s+/g, "_");
const parseCsv = (text: string) => {
  const rows = text.split(/\r?\n/).filter((row) => row.trim()).map((row) => row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
  if (rows.length < 2) return [] as Record<string, string>[];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
};

export async function POST(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.branch) return NextResponse.json({ error: "Create an active branch before importing products" }, { status: 409 });
  if (!canManageProducts(context.membership.role)) return NextResponse.json({ error: "You do not have permission to import products" }, { status: 403 });
  const rows = parseCsv(await request.text());
  if (!rows.length) return NextResponse.json({ error: "CSV must include a header row and at least one product row" }, { status: 400 });
  const imported: string[] = [];
  const failures: { row: number; error: string }[] = [];
  for (const [index, row] of rows.entries()) {
    try {
      if (!row.name || !row.sku || !row.price || !row.cost) throw new Error("name, sku, cost, and price are required");
      const category = row.category ? await prisma.category.upsert({ where: { businessId_name: { businessId: context.business.id, name: row.category } }, create: { businessId: context.business.id, name: row.category }, update: {} }) : null;
      const barcodes = (row.barcodes ?? "").split(";").map((value) => value.trim()).filter(Boolean);
      await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({ data: { businessId: context.business.id, categoryId: category?.id, name: row.name, sku: row.sku, costMinor: Math.round(Number(row.cost) * 100), priceMinor: Math.round(Number(row.price) * 100), reorderLevel: Math.max(0, Math.round(Number(row.reorder_level) || 0)) } });
        if (barcodes.length) await tx.productBarcode.createMany({ data: barcodes.map((value) => ({ businessId: context.business.id, productId: product.id, value })) });
        const openingQuantity = Math.max(0, Math.round(Number(row.opening_quantity) || 0));
        await tx.inventoryBalance.create({ data: { branchId: context.branch!.id, productId: product.id, quantity: openingQuantity } });
        if (openingQuantity) await tx.inventoryMovement.create({ data: { businessId: context.business.id, branchId: context.branch!.id, productId: product.id, type: "RECEIPT", quantity: openingQuantity, reference: "csv-import" } });
        await tx.auditLog.create({ data: { businessId: context.business.id, userId: context.user.id, action: "IMPORT", entity: "Product", entityId: product.id, metadata: { source: "csv" } } });
      });
      imported.push(row.sku);
    } catch (error) {
      failures.push({ row: index + 2, error: typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002" ? "SKU or barcode already exists" : error instanceof Error ? error.message : "Unable to import row" });
    }
  }
  return NextResponse.json({ imported: imported.length, failed: failures.length, failures, skus: imported }, { status: failures.length ? 207 : 201 });
}
