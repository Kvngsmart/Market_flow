import { NextResponse } from "next/server";
import { MembershipRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

const openingSchema = z.object({ openingFloatMinor: z.number().int().nonnegative().max(100000000) });
const closingSchema = z.object({ shiftId: z.string().cuid(), closingCashMinor: z.number().int().nonnegative().max(100000000) });

async function cashExpected(branchId: string, openedAt: Date, openingFloatMinor: number) {
  const sales = await prisma.sale.findMany({ where: { branchId, status: "COMPLETED", createdAt: { gte: openedAt } }, include: { payments: true } });
  const cashSales = sales.reduce((sum, sale) => sum + sale.payments.filter((payment) => payment.method === "cash" && payment.status === "SUCCEEDED").reduce((paymentSum, payment) => paymentSum + payment.amountMinor, 0), 0);
  return openingFloatMinor + cashSales;
}

export async function GET() {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.branch) return NextResponse.json({ register: null, shift: null });
  const register = await prisma.cashRegister.findFirst({ where: { businessId: context.business.id, branchId: context.branch.id, active: true }, orderBy: { createdAt: "asc" } });
  if (!register) return NextResponse.json({ register: null, shift: null });
  const shift = await prisma.registerShift.findFirst({ where: { registerId: register.id, status: "OPEN" }, orderBy: { openedAt: "desc" } });
  if (!shift) return NextResponse.json({ register, shift: null });
  const expectedCashMinor = await cashExpected(context.branch.id, shift.openedAt, shift.openingFloatMinor);
  return NextResponse.json({ register, shift: { ...shift, expectedCashMinor } });
}

export async function POST(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.branch) return NextResponse.json({ error: "Create an active branch before opening a register" }, { status: 409 });
  const parsed = openingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid opening float" }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const register = await tx.cashRegister.upsert({ where: { branchId_name: { branchId: context.branch!.id, name: "Register 01" } }, create: { businessId: context.business.id, branchId: context.branch!.id, name: "Register 01" }, update: { active: true } });
      const openShift = await tx.registerShift.findFirst({ where: { registerId: register.id, status: "OPEN" } });
      if (openShift) throw new RegisterError("This register already has an open shift", 409);
      const shift = await tx.registerShift.create({ data: { businessId: context.business.id, branchId: context.branch!.id, registerId: register.id, cashierId: context.user.id, openingFloatMinor: parsed.data.openingFloatMinor } });
      await tx.auditLog.create({ data: { businessId: context.business.id, userId: context.user.id, action: "OPEN", entity: "RegisterShift", entityId: shift.id, metadata: { openingFloatMinor: shift.openingFloatMinor } } });
      return { register, shift };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof RegisterError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to open register" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.branch) return NextResponse.json({ error: "Create an active branch before closing a register" }, { status: 409 });
  const parsed = closingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid closing cash amount" }, { status: 400 });
  const isManager = context.membership.role === MembershipRole.OWNER || context.membership.role === MembershipRole.MANAGER;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const shift = await tx.registerShift.findUnique({ where: { id: parsed.data.shiftId } });
      if (!shift || shift.businessId !== context.business.id || shift.branchId !== context.branch.id || shift.status !== "OPEN") throw new RegisterError("Open shift not found", 404);
      if (shift.cashierId !== context.user.id && !isManager) throw new RegisterError("Only the assigned cashier or a manager can close this shift", 403);
      const sales = await tx.sale.findMany({ where: { branchId: shift.branchId, status: "COMPLETED", createdAt: { gte: shift.openedAt } }, include: { payments: true } });
      const cashSales = sales.reduce((sum, sale) => sum + sale.payments.filter((payment) => payment.method === "cash" && payment.status === "SUCCEEDED").reduce((paymentSum, payment) => paymentSum + payment.amountMinor, 0), 0);
      const expectedCashMinor = shift.openingFloatMinor + cashSales;
      const closed = await tx.registerShift.update({ where: { id: shift.id }, data: { status: "CLOSED", expectedCashMinor, closingCashMinor: parsed.data.closingCashMinor, closedAt: new Date() } });
      await tx.auditLog.create({ data: { businessId: context.business.id, userId: context.user.id, action: "CLOSE", entity: "RegisterShift", entityId: shift.id, metadata: { expectedCashMinor, closingCashMinor: parsed.data.closingCashMinor, varianceMinor: parsed.data.closingCashMinor - expectedCashMinor } } });
      return closed;
    });
    return NextResponse.json({ shift: result, varianceMinor: (result.closingCashMinor ?? 0) - (result.expectedCashMinor ?? 0) });
  } catch (error) {
    if (error instanceof RegisterError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to close register" }, { status: 500 });
  }
}

class RegisterError extends Error {
  constructor(message: string, public status: 403 | 404 | 409) {
    super(message);
  }
}
