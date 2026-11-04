import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const barcode = new URL(request.url).searchParams.get("barcode")?.trim();
  if (!barcode) return NextResponse.json({ error: "Barcode is required" }, { status: 400 });
  const association = await prisma.productBarcode.findFirst({ where: { businessId: context.business.id, value: barcode, active: true }, include: { product: { include: { category: true, balances: context.branch ? { where: { branchId: context.branch.id } } : true } } } });
  if (!association) return NextResponse.json({ error: "Unknown barcode" }, { status: 404 });
  return NextResponse.json({ product: association.product, barcode: association.value });
}
