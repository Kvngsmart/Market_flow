import { MembershipRole } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { BRANCH_COOKIE, getSession } from "./auth";

export async function getTenantContext() {
  const session = await getSession();
  if (!session) return null;
  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, businessId: session.businessId },
    select: { id: true, role: true, userId: true, businessId: true }
  });
  if (!membership) return null;
  const [user, business, branches, cookieStore] = await Promise.all([
    prisma.user.findUnique({ where: { id: membership.userId }, select: { id: true, name: true, email: true } }),
    prisma.business.findUnique({ where: { id: membership.businessId } }),
    prisma.branch.findMany({ where: { businessId: membership.businessId, active: true }, orderBy: { name: "asc" } }),
    cookies()
  ]);
  if (!user || !business) return null;
  const requestedBranchId = cookieStore.get(BRANCH_COOKIE)?.value;
  const branch = branches.find((candidate) => candidate.id === requestedBranchId) ?? branches[0] ?? null;
  return { session, membership, user, business, branch, branches };
}

export function canManageProducts(role: MembershipRole) {
  return role === MembershipRole.OWNER || role === MembershipRole.MANAGER || role === MembershipRole.INVENTORY_OFFICER;
}
