import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  businessName: z.string().trim().min(2).max(120),
  businessCategory: z.string().trim().min(2).max(80).optional(),
  branchName: z.string().trim().min(2).max(80).default("Main Store")
});

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid registration details", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const passwordHash = await hashPassword(input.password);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: input.email } });
      if (existing) throw new Error("EMAIL_EXISTS");
      const user = await tx.user.create({ data: { email: input.email, name: input.name, passwordHash } });
      const business = await tx.business.create({ data: { name: input.businessName, slug: `${slugify(input.businessName)}-${user.id.slice(-6)}`, category: input.businessCategory } });
      await tx.membership.create({ data: { businessId: business.id, userId: user.id, role: "OWNER" } });
      const branch = await tx.branch.create({ data: { businessId: business.id, name: input.branchName } });
      return { user, business, branch };
    });
    const response = NextResponse.json({ user: { id: result.user.id, name: result.user.name, email: result.user.email }, business: result.business, branch: result.branch }, { status: 201 });
    setSessionCookie(response, createSessionToken({ userId: result.user.id, businessId: result.business.id, role: "OWNER" }));
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    return NextResponse.json({ error: "Unable to create the account" }, { status: 500 });
  }
}
