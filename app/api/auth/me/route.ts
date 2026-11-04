import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";

export async function GET() {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, user: context.user, business: context.business, branch: context.branch, role: context.membership.role });
}
