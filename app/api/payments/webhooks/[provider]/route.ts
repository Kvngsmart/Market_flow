import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPaymentProvider, normalizeWebhook, verifyWebhookSignature } from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerName } = await params;
  if (!isPaymentProvider(providerName)) return NextResponse.json({ error: "Unsupported payment provider" }, { status: 404 });
  const rawBody = await request.text();
  if (!verifyWebhookSignature(providerName, rawBody, request.headers)) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 }); }
  const event = normalizeWebhook(providerName, payload);
  if (!event) return NextResponse.json({ received: true, ignored: true });
  const payment = await prisma.payment.findFirst({ where: { reference: event.reference, provider: providerName }, include: { sale: { include: { business: true } } } });
  if (!payment) return NextResponse.json({ received: true, ignored: true });
  if (event.amountMinor !== payment.amountMinor || (event.currency && event.currency !== payment.sale.business.currency)) return NextResponse.json({ error: "Webhook amount or currency does not match the payment" }, { status: 409 });
  await prisma.payment.update({ where: { id: payment.id }, data: { status: event.status, metadata: { provider: providerName, event: event.event, receivedAt: new Date().toISOString(), payload: event.raw as Prisma.InputJsonValue } } });
  return NextResponse.json({ received: true, paymentId: payment.id, status: event.status });
}
