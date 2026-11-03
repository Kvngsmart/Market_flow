import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageProducts, getTenantContext } from "@/lib/tenant";

const categorySchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET() {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const categories = await prisma.category.findMany({ where: { businessId: context.business.id }, orderBy: { name: "asc" } });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!canManageProducts(context.membership.role)) return NextResponse.json({ error: "You do not have permission to manage categories" }, { status: 403 });
  const parsed = categorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid category name" }, { status: 400 });
  try {
    const category = await prisma.category.create({ data: { businessId: context.business.id, name: parsed.data.name } });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") return NextResponse.json({ error: "That category already exists" }, { status: 409 });
    return NextResponse.json({ error: "Unable to create category" }, { status: 500 });
  }
}
