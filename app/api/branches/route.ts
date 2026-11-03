import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

const branchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(240).optional()
});

const canManageBranches = (role: string) => role === "OWNER" || role === "MANAGER";

export async function GET() {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const balances = await prisma.inventoryBalance.groupBy({
    by: ["branchId"],
    where: { branch: { businessId: context.business.id, active: true } },
    _sum: { quantity: true },
    _count: { productId: true }
  });
  const summary = new Map(balances.map((balance) => [balance.branchId, { units: balance._sum.quantity ?? 0, products: balance._count.productId }]));
  return NextResponse.json({ branches: context.branches.map((branch) => ({ ...branch, summary: summary.get(branch.id) ?? { units: 0, products: 0 } })), selectedBranchId: context.branch?.id ?? null });
}

export async function POST(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!canManageBranches(context.membership.role)) return NextResponse.json({ error: "You do not have permission to manage branches" }, { status: 403 });
  const parsed = branchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid branch name and address" }, { status: 400 });
  try {
    const branch = await prisma.$transaction(async (tx) => {
      const created = await tx.branch.create({ data: { businessId: context.business.id, name: parsed.data.name, address: parsed.data.address || null } });
      await tx.auditLog.create({ data: { businessId: context.business.id, userId: context.user.id, action: "CREATE", entity: "Branch", entityId: created.id, metadata: { name: created.name } } });
      return created;
    });
    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") return NextResponse.json({ error: "A branch with this name already exists" }, { status: 409 });
    return NextResponse.json({ error: "Unable to create branch" }, { status: 500 });
  }
}
