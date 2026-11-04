import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageProducts, getTenantContext } from "@/lib/tenant";

const adjustmentSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(-100000).max(100000).refine((value) => value !== 0),
  type: z.enum(["RECEIPT", "ADJUSTMENT", "DAMAGE", "EXPIRY"]),
  reference: z.string().trim().max(160).optional()
});

export async function POST(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.branch) return NextResponse.json({ error: "Create an active branch before adjusting inventory" }, { status: 409 });
  if (!canManageProducts(context.membership.role)) return NextResponse.json({ error: "You do not have permission to adjust inventory" }, { status: 403 });
  const parsed = adjustmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid inventory adjustment" }, { status: 400 });
  const input = parsed.data;
  const delta = input.type === "RECEIPT" ? Math.abs(input.quantity) : input.type === "DAMAGE" || input.type === "EXPIRY" ? -Math.abs(input.quantity) : input.quantity;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!product || product.businessId !== context.business.id || !product.active) throw new InventoryError("Product is unavailable in this workspace", 400);
      const changed = delta > 0
        ? await tx.inventoryBalance.updateMany({ where: { branchId: context.branch!.id, productId: product.id }, data: { quantity: { increment: delta } } })
        : await tx.inventoryBalance.updateMany({ where: { branchId: context.branch!.id, productId: product.id, quantity: { gte: Math.abs(delta) } }, data: { quantity: { decrement: Math.abs(delta) } } });
      if (changed.count !== 1) throw new InventoryError("The adjustment would create negative stock", 409);
      const balance = await tx.inventoryBalance.findUnique({ where: { branchId_productId: { branchId: context.branch!.id, productId: product.id } } });
      const movement = await tx.inventoryMovement.create({ data: { businessId: context.business.id, branchId: context.branch!.id, productId: product.id, type: input.type, quantity: delta, reference: input.reference ?? input.type.toLowerCase() } });
      await tx.auditLog.create({ data: { businessId: context.business.id, userId: context.user.id, action: "ADJUST", entity: "Inventory", entityId: product.id, metadata: { type: input.type, quantity: delta, reference: input.reference } } });
      return { product, balance, movement };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof InventoryError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to adjust inventory" }, { status: 500 });
  }
}

class InventoryError extends Error {
  constructor(message: string, public status: 400 | 409) {
    super(message);
  }
}
