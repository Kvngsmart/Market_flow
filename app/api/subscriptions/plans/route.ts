import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const plans = await prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { monthlyMinor: "asc" } });
  return NextResponse.json({ plans });
}
