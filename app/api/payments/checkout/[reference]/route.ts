import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const checkout = await prisma.paymentCheckout.findUnique({ where: { reference }, select: { reference: true, provider: true, status: true, amountMinor: true, currency: true, checkoutUrl: true, saleId: true, expiresAt: true } });
  if (!checkout) return NextResponse.json({ error: "Checkout not found" }, { status: 404 });
  if (checkout.status === "PENDING" && checkout.expiresAt < new Date()) {
    const expired = await prisma.paymentCheckout.update({ where: { reference }, data: { status: "FAILED", metadata: { reason: "expired" } }, select: { reference: true, provider: true, status: true, amountMinor: true, currency: true, checkoutUrl: true, saleId: true, expiresAt: true } });
    return NextResponse.json({ checkout: expired });
  }
  return NextResponse.json({ checkout });
}
