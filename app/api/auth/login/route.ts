import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, include: { memberships: { orderBy: { createdAt: "asc" } } } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  const membership = user.memberships[0];
  if (!membership) return NextResponse.json({ error: "This account is not linked to a business" }, { status: 403 });
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email }, businessId: membership.businessId, role: membership.role });
  setSessionCookie(response, createSessionToken({ userId: user.id, businessId: membership.businessId, role: membership.role }));
  return response;
}
