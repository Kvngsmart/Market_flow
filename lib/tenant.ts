import { MembershipRole } from "@prisma/client";
import { prisma } from "./prisma";
import { getSession } from "./auth";

export async function getTenantContext() {
  const session = await getSession();
  if (!session) return null;
  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, businessId: session.businessId },
    select: { id: true, role: true, userId: true, businessId: true }
  });
  if (!membership) return null;
  const [user, business, branches] = await Promise.all([
    prisma.user.findUnique({ where: { id: membership.userId }, select: { id: true, name: true, email: true } }),
    prisma.business.findUnique({ where: { id: membership.businessId } }),
    prisma.branch.findMany({ where: { businessId: membership.businessId, active: true }, orderBy: { name: "asc" } })
  ]);
  if (!user || !business) return null;
  return { session, membership, user, business, branch: branches[0] ?? null };
}

export function canManageProducts(role: MembershipRole) {
  return role === MembershipRole.OWNER || role === MembershipRole.MANAGER || role === MembershipRole.INVENTORY_OFFICER;
}
