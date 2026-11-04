import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageProducts, getTenantContext } from "@/lib/tenant";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(80),
  categoryId: z.string().cuid().nullable().optional(),
  costMinor: z.number().int().nonnegative(),
  priceMinor: z.number().int().nonnegative(),
  reorderLevel: z.number().int().nonnegative().default(0),
  barcodes: z.array(z.string().trim().min(1).max(64)).max(100).default([])
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!canManageProducts(context.membership.role)) return NextResponse.json({ error: "You do not have permission to edit products" }, { status: 403 });
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid product details", issues: parsed.error.flatten() }, { status: 400 });
  if (new Set(parsed.data.barcodes).size !== parsed.data.barcodes.length) return NextResponse.json({ error: "Duplicate barcodes are not allowed" }, { status: 409 });
  try {
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing || existing.businessId !== context.business.id || !existing.active) throw new ProductError("Product not found in this workspace", 404);
      if (parsed.data.categoryId && !(await tx.category.findFirst({ where: { id: parsed.data.categoryId, businessId: context.business.id } }))) throw new ProductError("Category does not belong to this business", 400);
      const updated = await tx.product.update({ where: { id }, data: { name: parsed.data.name, sku: parsed.data.sku, categoryId: parsed.data.categoryId, costMinor: parsed.data.costMinor, priceMinor: parsed.data.priceMinor, reorderLevel: parsed.data.reorderLevel } });
      await tx.productBarcode.updateMany({ where: { productId: id, active: true }, data: { active: false } });
      if (parsed.data.barcodes.length) await tx.productBarcode.createMany({ data: parsed.data.barcodes.map((value) => ({ businessId: context.business.id, productId: id, value })) });
      await tx.auditLog.create({ data: { businessId: context.business.id, userId: context.user.id, action: "UPDATE", entity: "Product", entityId: id, metadata: { sku: updated.sku } } });
      return tx.product.findUniqueOrThrow({ where: { id }, include: { category: true, barcodes: { where: { active: true } }, balances: true } });
    });
    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof ProductError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") return NextResponse.json({ error: "SKU or barcode already exists in this business" }, { status: 409 });
    return NextResponse.json({ error: "Unable to update product" }, { status: 500 });
  }
}

class ProductError extends Error {
  constructor(message: string, public status: 400 | 404) {
    super(message);
  }
}
