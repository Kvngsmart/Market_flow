import { NextResponse } from "next/server";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (context.membership.role !== MembershipRole.OWNER && context.membership.role !== MembershipRole.MANAGER) return NextResponse.json({ error: "Only owners and managers can refund sales" }, { status: 403 });
  if (!context.branch) return NextResponse.json({ error: "Create an active branch before processing refunds" }, { status: 409 });
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id }, include: { items: true, payments: true } });
      if (!sale || sale.businessId !== context.business.id || sale.branchId !== context.branch!.id) throw new RefundError("Sale not found in this workspace", 404);
      if (sale.status !== "COMPLETED") throw new RefundError("Only completed sales can be refunded", 409);
      const updated = await tx.sale.update({ where: { id: sale.id }, data: { status: "REFUNDED" }, include: { items: true, payments: true } });
      await tx.payment.updateMany({ where: { saleId: sale.id, status: "SUCCEEDED" }, data: { status: "REFUNDED" } });
      for (const item of sale.items) {
        await tx.inventoryBalance.upsert({ where: { branchId_productId: { branchId: sale.branchId, productId: item.productId } }, create: { branchId: sale.branchId, productId: item.productId, quantity: item.quantity }, update: { quantity: { increment: item.quantity } } });
        await tx.inventoryMovement.create({ data: { businessId: sale.businessId, branchId: sale.branchId, productId: item.productId, type: "RETURN", quantity: item.quantity, reference: sale.reference } });
      }
      await tx.auditLog.create({ data: { businessId: sale.businessId, userId: context.user.id, action: "REFUND", entity: "Sale", entityId: sale.id, metadata: { reference: sale.reference, totalMinor: sale.totalMinor } } });
      return updated;
    });
    return NextResponse.json({ sale: result });
  } catch (error) {
    if (error instanceof RefundError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to refund sale" }, { status: 500 });
  }
}

class RefundError extends Error {
  constructor(message: string, public status: 403 | 404 | 409) {
    super(message);
  }
}
