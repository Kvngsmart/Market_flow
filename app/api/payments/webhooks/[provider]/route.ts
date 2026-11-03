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
  if (payment) {
    if (event.amountMinor !== payment.amountMinor || (event.currency && event.currency !== payment.sale.business.currency)) return NextResponse.json({ error: "Webhook amount or currency does not match the payment" }, { status: 409 });
    await prisma.payment.update({ where: { id: payment.id }, data: { status: event.status, metadata: { provider: providerName, event: event.event, receivedAt: new Date().toISOString(), payload: event.raw as Prisma.InputJsonValue } } });
    return NextResponse.json({ received: true, paymentId: payment.id, status: event.status });
  }

  const checkout = await prisma.paymentCheckout.findFirst({ where: { reference: event.reference, provider: providerName }, include: { business: true } });
  if (!checkout) return NextResponse.json({ received: true, ignored: true });
  if (event.amountMinor !== checkout.amountMinor || (event.currency && event.currency !== checkout.currency)) return NextResponse.json({ error: "Webhook amount or currency does not match the checkout" }, { status: 409 });
  if (checkout.status === "SUCCEEDED") return NextResponse.json({ received: true, checkoutId: checkout.id, status: checkout.status, duplicate: true });
  if (event.status !== "SUCCEEDED") {
    const updated = await prisma.paymentCheckout.update({ where: { id: checkout.id }, data: { status: event.status, metadata: { provider: providerName, event: event.event, receivedAt: new Date().toISOString(), payload: event.raw as Prisma.InputJsonValue } } });
    return NextResponse.json({ received: true, checkoutId: updated.id, status: updated.status });
  }

  const rawItems = Array.isArray(checkout.items) ? checkout.items : [];
  const items = rawItems.map((item) => {
    const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return { productId: typeof value.productId === "string" ? value.productId : "", quantity: typeof value.quantity === "number" ? value.quantity : 0, unitPriceMinor: typeof value.unitPriceMinor === "number" ? value.unitPriceMinor : 0, costMinor: typeof value.costMinor === "number" ? value.costMinor : 0 };
  });
  if (!items.length || items.some((item) => !item.productId || item.quantity < 1)) return NextResponse.json({ error: "Checkout line items are invalid" }, { status: 409 });
  try {
    const finalized = await prisma.$transaction(async (tx) => {
      const current = await tx.paymentCheckout.findUnique({ where: { id: checkout.id } });
      if (!current) throw new FinalizationError("Checkout not found", 404);
      if (current.status === "SUCCEEDED" && current.saleId) return { saleId: current.saleId, duplicate: true };
      for (const item of items) {
        const product = await tx.product.findFirst({ where: { id: item.productId, businessId: checkout.businessId, active: true } });
        if (!product) throw new FinalizationError("A checkout product is unavailable", 409);
        const changed = await tx.inventoryBalance.updateMany({ where: { branchId: checkout.branchId, productId: item.productId, quantity: { gte: item.quantity } }, data: { quantity: { decrement: item.quantity } } });
        if (changed.count !== 1) throw new FinalizationError("There is not enough stock to settle this checkout", 409);
      }
      const sale = await tx.sale.create({ data: { businessId: checkout.businessId, branchId: checkout.branchId, cashierId: checkout.cashierId, reference: `MF-${Date.now().toString(36).toUpperCase()}-${checkout.id.slice(-6).toUpperCase()}`, subtotalMinor: checkout.amountMinor, totalMinor: checkout.amountMinor, idempotencyKey: `checkout:${checkout.id}`, items: { create: items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, costMinor: item.costMinor })) }, payments: { create: { status: "SUCCEEDED", method: `${providerName}_checkout`, amountMinor: checkout.amountMinor, provider: providerName, reference: event.reference } } } });
      for (const item of items) await tx.inventoryMovement.create({ data: { businessId: checkout.businessId, branchId: checkout.branchId, productId: item.productId, type: "SALE", quantity: -item.quantity, reference: sale.reference } });
      await tx.paymentCheckout.update({ where: { id: checkout.id }, data: { status: "SUCCEEDED", saleId: sale.id, metadata: { provider: providerName, event: event.event, receivedAt: new Date().toISOString(), payload: event.raw as Prisma.InputJsonValue } } });
      await tx.auditLog.create({ data: { businessId: checkout.businessId, userId: checkout.cashierId, action: "SETTLE", entity: "PaymentCheckout", entityId: checkout.id, metadata: { saleId: sale.id, provider: providerName, reference: event.reference } } });
      return { saleId: sale.id, duplicate: false };
    });
    return NextResponse.json({ received: true, checkoutId: checkout.id, saleId: finalized.saleId, status: "SUCCEEDED", duplicate: finalized.duplicate });
  } catch (error) {
    if (error instanceof FinalizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to settle hosted checkout" }, { status: 500 });
  }
}

class FinalizationError extends Error {
  constructor(message: string, public status: 404 | 409) { super(message); }
}
