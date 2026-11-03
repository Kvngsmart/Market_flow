import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createHostedCheckout, HostedCheckoutError, isPaymentProvider, isPaymentProviderConfigured } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

const checkoutSchema = z.object({
  provider: z.string().refine(isPaymentProvider, "Unsupported payment provider"),
  items: z.array(z.object({ productId: z.string().cuid(), quantity: z.number().int().positive().max(10000) })).min(1).max(100),
  customerEmail: z.string().email().optional(),
  customerName: z.string().trim().min(2).max(120).optional()
});

export async function POST(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.branch) return NextResponse.json({ error: "Create an active branch before starting checkout" }, { status: 409 });
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid checkout details", issues: parsed.error.flatten() }, { status: 400 });
  const provider = parsed.data.provider;
  if (!isPaymentProviderConfigured(provider)) return NextResponse.json({ error: `${provider} is not configured for this workspace` }, { status: 503 });

  const quantities = new Map<string, number>();
  for (const item of parsed.data.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  const items = [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  const products = await prisma.product.findMany({ where: { id: { in: items.map((item) => item.productId) }, businessId: context.business.id, active: true }, include: { balances: { where: { branchId: context.branch.id } } } });
  if (products.length !== items.length) return NextResponse.json({ error: "One or more products are unavailable in this workspace" }, { status: 400 });
  const snapshots = items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId)!;
    const balance = product.balances[0]?.quantity ?? 0;
    return { productId: product.id, name: product.name, sku: product.sku, quantity: item.quantity, unitPriceMinor: product.priceMinor, costMinor: product.costMinor, availableQuantity: balance };
  });
  if (snapshots.some((item) => item.availableQuantity < item.quantity)) return NextResponse.json({ error: "One or more products do not have enough stock" }, { status: 409 });
  const amountMinor = snapshots.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0);
  const reference = `MF-PAY-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/api/payments/checkout/${reference}`;
  const email = parsed.data.customerEmail ?? context.user.email;
  const customerName = parsed.data.customerName ?? context.user.name;
  const checkout = await prisma.paymentCheckout.create({ data: { businessId: context.business.id, branchId: context.branch.id, cashierId: context.user.id, provider, reference, amountMinor, currency: context.business.currency, items: snapshots as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 30 * 60 * 1000), metadata: { customerEmail: email, customerName } } });
  try {
    const initialized = await createHostedCheckout(provider, { email, customerName, amountMinor, currency: context.business.currency, reference, callbackUrl, metadata: { marketflowCheckoutId: checkout.id, branchId: context.branch.id } });
    const updated = await prisma.paymentCheckout.update({ where: { id: checkout.id }, data: { checkoutUrl: initialized.checkoutUrl, metadata: { customerEmail: email, customerName, providerReference: initialized.providerReference, response: initialized.raw as Prisma.InputJsonValue } } });
    return NextResponse.json({ checkout: { id: updated.id, reference: updated.reference, provider: updated.provider, status: updated.status, amountMinor: updated.amountMinor, currency: updated.currency, checkoutUrl: updated.checkoutUrl, expiresAt: updated.expiresAt } }, { status: 201 });
  } catch (error) {
    await prisma.paymentCheckout.update({ where: { id: checkout.id }, data: { status: "FAILED", metadata: { error: error instanceof Error ? error.message : "Provider initialization failed" } } });
    if (error instanceof HostedCheckoutError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to initialize hosted checkout" }, { status: 502 });
  }
}
