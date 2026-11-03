import { NextResponse } from "next/server";
import { BRANCH_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export async function POST(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { branchId?: string } | null;
  if (!body?.branchId) return NextResponse.json({ error: "Select a branch" }, { status: 400 });
  const branch = await prisma.branch.findFirst({ where: { id: body.branchId, businessId: context.business.id, active: true } });
  if (!branch) return NextResponse.json({ error: "Branch not found in this workspace" }, { status: 404 });
  const response = NextResponse.json({ branch });
  response.cookies.set({ name: BRANCH_COOKIE, value: branch.id, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
