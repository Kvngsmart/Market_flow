import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageProducts, getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(80),
  description: z.string().trim().max(5000).optional(),
  categoryId: z.string().cuid().optional(),
  costMinor: z.number().int().nonnegative(),
  priceMinor: z.number().int().nonnegative(),
  reorderLevel: z.number().int().nonnegative().default(0),
  openingQuantity: z.number().int().nonnegative().default(0),
  barcodes: z.array(z.string().trim().min(1).max(64)).max(100).default([])
});

export async function GET(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const products = await prisma.product.findMany({
    where: { businessId: context.business.id, active: true, ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }, { barcodes: { some: { value: query, active: true } } }] } : {}) },
    include: { category: true, barcodes: { where: { active: true } }, balances: context.branch ? { where: { branchId: context.branch.id } } : true },
    orderBy: { name: "asc" },
    take: 200
  });
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!canManageProducts(context.membership.role)) return NextResponse.json({ error: "You do not have permission to create products" }, { status: 403 });
  if (!context.branch) return NextResponse.json({ error: "Create an active branch before adding products" }, { status: 409 });
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid product details", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if (new Set(input.barcodes).size !== input.barcodes.length) return NextResponse.json({ error: "Duplicate barcodes are not allowed" }, { status: 409 });
  if (input.categoryId && !(await prisma.category.findFirst({ where: { id: input.categoryId, businessId: context.business.id } }))) return NextResponse.json({ error: "Category does not belong to this business" }, { status: 400 });

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: { businessId: context.business.id, categoryId: input.categoryId, name: input.name, sku: input.sku, description: input.description, costMinor: input.costMinor, priceMinor: input.priceMinor, reorderLevel: input.reorderLevel } });
      if (input.barcodes.length) await tx.productBarcode.createMany({ data: input.barcodes.map((value) => ({ businessId: context.business.id, productId: created.id, value })) });
      await tx.inventoryBalance.create({ data: { branchId: context.branch!.id, productId: created.id, quantity: input.openingQuantity } });
      if (input.openingQuantity > 0) await tx.inventoryMovement.create({ data: { businessId: context.business.id, branchId: context.branch!.id, productId: created.id, type: "RECEIPT", quantity: input.openingQuantity, reference: "opening-balance" } });
      return tx.product.findUniqueOrThrow({ where: { id: created.id }, include: { barcodes: true, balances: true, category: true } });
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") return NextResponse.json({ error: "SKU or barcode already exists in this business" }, { status: 409 });
    return NextResponse.json({ error: "Unable to create product" }, { status: 500 });
  }
}
