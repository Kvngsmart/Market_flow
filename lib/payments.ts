import { createHmac, timingSafeEqual } from "node:crypto";

export type PaymentProvider = "paystack" | "flutterwave" | "monnify";
export type NormalizedWebhook = { reference: string; status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED"; amountMinor: number; currency: string; event: string; raw: Record<string, unknown> };

const providerSecrets: Record<PaymentProvider, string | undefined> = {
  paystack: process.env.PAYSTACK_SECRET_KEY,
  flutterwave: process.env.FLUTTERWAVE_SECRET_HASH,
  monnify: process.env.MONNIFY_SECRET_KEY
};

export const paymentProviders = [
  { id: "paystack" as const, name: "Paystack", description: "Cards, bank transfer, USSD, and dedicated payment pages.", configured: Boolean(providerSecrets.paystack) },
  { id: "flutterwave" as const, name: "Flutterwave", description: "Cards, bank transfer, USSD, and international payments.", configured: Boolean(providerSecrets.flutterwave) },
  { id: "monnify" as const, name: "Monnify", description: "Bank transfer and virtual-account collections.", configured: Boolean(providerSecrets.monnify) }
];

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isPaymentProvider(value: string): value is PaymentProvider {
  return value === "paystack" || value === "flutterwave" || value === "monnify";
}

export function verifyWebhookSignature(provider: PaymentProvider, rawBody: string, headers: Headers) {
  const secret = providerSecrets[provider];
  if (!secret) return false;
  if (provider === "flutterwave") return safeEqual(headers.get("verif-hash") ?? "", secret);
  const provided = provider === "paystack" ? headers.get("x-paystack-signature") : headers.get("monnify-signature");
  if (!provided) return false;
  return safeEqual(createHmac("sha512", secret).update(rawBody).digest("hex"), provided);
}

const objectValue = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};
const textValue = (...values: unknown[]) => values.find((value): value is string => typeof value === "string" && value.length > 0) ?? "";
const numberValue = (...values: unknown[]) => values.find((value): value is number => typeof value === "number") ?? Number(values.find((value) => typeof value === "string") ?? 0);

export function normalizeWebhook(provider: PaymentProvider, payload: unknown): NormalizedWebhook | null {
  const root = objectValue(payload);
  const data = objectValue(root.data ?? root.eventData ?? root);
  const statusText = textValue(data.status, data.paymentStatus, root.event, root.status).toLowerCase();
  const status = statusText.includes("success") || statusText === "paid" || statusText === "successful" ? "SUCCEEDED" : statusText.includes("refund") ? "REFUNDED" : statusText.includes("fail") ? "FAILED" : "PENDING";
  const amount = numberValue(data.amount, data.amountPaid, data.paidAmount);
  const amountMinor = provider === "paystack" ? Math.round(amount) : Math.round(amount * 100);
  const reference = provider === "paystack" ? textValue(data.reference) : provider === "flutterwave" ? textValue(data.tx_ref, data.transaction_id) : textValue(data.transactionReference, data.paymentReference);
  if (!reference) return null;
  return { reference, status, amountMinor, currency: textValue(data.currency, data.currencyCode).toUpperCase(), event: textValue(root.event, root.eventType, statusText), raw: root };
}
