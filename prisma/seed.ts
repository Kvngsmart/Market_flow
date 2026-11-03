import { PrismaClient, MembershipRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({ where: { email: "amaka@example.com" }, update: {}, create: { email: "amaka@example.com", name: "Amaka Okafor", passwordHash: "REPLACE_WITH_ARGON2_HASH" } });
  const business = await prisma.business.upsert({ where: { slug: "sunrise-mart" }, update: {}, create: { name: "Sunrise Mart", slug: "sunrise-mart", category: "Retail" } });
  await prisma.membership.upsert({ where: { businessId_userId: { businessId: business.id, userId: owner.id } }, update: { role: MembershipRole.OWNER }, create: { businessId: business.id, userId: owner.id, role: MembershipRole.OWNER } });
  await prisma.branch.upsert({ where: { id: "seed-sunrise-main" }, update: {}, create: { id: "seed-sunrise-main", businessId: business.id, name: "Main Store", address: "Lagos, Nigeria" } });
  for (const plan of [{ name: "Starter", monthlyMinor: 500000, annualMinor: 5000000 }, { name: "Business", monthlyMinor: 1500000, annualMinor: 15000000 }, { name: "Enterprise", monthlyMinor: 3500000, annualMinor: 35000000 }]) {
    await prisma.subscriptionPlan.upsert({ where: { name: plan.name }, update: plan, create: { ...plan, features: [] } });
  }
}

main().finally(() => prisma.$disconnect());
