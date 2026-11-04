import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageProducts, getTenantContext } from "@/lib/tenant";

const transferSchema = z.object({
  productId: z.string().cuid(),
  toBranchId: z.string().cuid(),
  quantity: z.number().int().positive().max(100000),
  reference: z.string().trim().max(160).optional()
});

export async function POST(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.branch) return NextResponse.json({ error: "Create an active source branch before transferring stock" }, { status: 409 });
  if (!canManageProducts(context.membership.role)) return NextResponse.json({ error: "You do not have permission to transfer inventory" }, { status: 403 });
  const parsed = transferSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid product, destination, and quantity" }, { status: 400 });
  if (parsed.data.toBranchId === context.branch.id) return NextResponse.json({ error: "Choose a different destination branch" }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const destination = await tx.branch.findFirst({ where: { id: parsed.data.toBranchId, businessId: context.business.id, active: true } });
      if (!destination) throw new TransferError("Destination branch not found", 404);
      const product = await tx.product.findFirst({ where: { id: parsed.data.productId, businessId: context.business.id, active: true } });
      if (!product) throw new TransferError("Product is unavailable in this workspace", 404);
      const source = await tx.inventoryBalance.updateMany({ where: { branchId: context.branch!.id, productId: product.id, quantity: { gte: parsed.data.quantity } }, data: { quantity: { decrement: parsed.data.quantity } } });
      if (source.count !== 1) throw new TransferError("The transfer would create negative stock", 409);
      const target = await tx.inventoryBalance.upsert({ where: { branchId_productId: { branchId: destination.id, productId: product.id } }, create: { branchId: destination.id, productId: product.id, quantity: parsed.data.quantity }, update: { quantity: { increment: parsed.data.quantity } } });
      const transfer = await tx.inventoryTransfer.create({ data: { businessId: context.business.id, productId: product.id, fromBranchId: context.branch!.id, toBranchId: destination.id, quantity: parsed.data.quantity, reference: parsed.data.reference || null } });
      const reference = parsed.data.reference || `transfer:${transfer.id}`;
      await tx.inventoryMovement.createMany({ data: [
        { businessId: context.business.id, branchId: context.branch!.id, productId: product.id, type: "TRANSFER_OUT", quantity: -parsed.data.quantity, reference, metadata: { transferId: transfer.id, toBranchId: destination.id } },
        { businessId: context.business.id, branchId: destination.id, productId: product.id, type: "TRANSFER_IN", quantity: parsed.data.quantity, reference, metadata: { transferId: transfer.id, fromBranchId: context.branch!.id } }
      ] });
      await tx.auditLog.create({ data: { businessId: context.business.id, userId: context.user.id, action: "TRANSFER", entity: "InventoryTransfer", entityId: transfer.id, metadata: { productId: product.id, fromBranchId: context.branch!.id, toBranchId: destination.id, quantity: parsed.data.quantity } } });
      return { transfer, sourceBranchId: context.branch.id, destination, target };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof TransferError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to transfer inventory" }, { status: 500 });
  }
}

class TransferError extends Error {
  constructor(message: string, public status: 400 | 404 | 409) { super(message); }
}
