import { createHmac, timingSafeEqual } from "node:crypto";

export type PaymentProvider = "paystack" | "flutterwave" | "monnify";
export type NormalizedWebhook = { reference: string; status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED"; amountMinor: number; currency: string; event: string; raw: Record<string, unknown> };

const providerApiSecrets: Record<PaymentProvider, string | undefined> = {
  paystack: process.env.PAYSTACK_SECRET_KEY,
  flutterwave: process.env.FLUTTERWAVE_SECRET_KEY,
  monnify: process.env.MONNIFY_SECRET_KEY
};
const webhookSecrets: Record<PaymentProvider, string | undefined> = {
  paystack: process.env.PAYSTACK_SECRET_KEY,
  flutterwave: process.env.FLUTTERWAVE_SECRET_HASH ?? process.env.FLUTTERWAVE_SECRET_KEY,
  monnify: process.env.MONNIFY_SECRET_KEY
};

export const paymentProviders = [
  { id: "paystack" as const, name: "Paystack", description: "Cards, bank transfer, USSD, and dedicated payment pages.", configured: Boolean(providerApiSecrets.paystack) },
  { id: "flutterwave" as const, name: "Flutterwave", description: "Cards, bank transfer, USSD, and international payments.", configured: Boolean(providerApiSecrets.flutterwave) },
  { id: "monnify" as const, name: "Monnify", description: "Bank transfer and virtual-account collections.", configured: Boolean(providerApiSecrets.monnify) }
];

export type HostedCheckoutInput = {
  email: string;
  customerName: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
};

export type HostedCheckoutResult = { checkoutUrl: string; providerReference?: string; raw: Record<string, unknown> };

export class HostedCheckoutError extends Error {
  constructor(message: string, public status: 400 | 502 | 503 = 502) { super(message); }
}

const responseObject = async (response: Response) => {
  const payload = await response.json().catch(() => null) as unknown;
  return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
};

const nestedObject = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};

export function isPaymentProviderConfigured(provider: PaymentProvider) {
  return Boolean(providerApiSecrets[provider]);
}

export async function createHostedCheckout(provider: PaymentProvider, input: HostedCheckoutInput): Promise<HostedCheckoutResult> {
  if (!isPaymentProviderConfigured(provider)) throw new HostedCheckoutError(`${provider} is not configured for this workspace`, 503);
  const commonHeaders = { "Content-Type": "application/json" };
  let response: Response;
  if (provider === "paystack") {
    response = await fetch("https://api.paystack.co/transaction/initialize", { method: "POST", headers: { ...commonHeaders, Authorization: `Bearer ${providerApiSecrets.paystack}` }, body: JSON.stringify({ email: input.email, amount: String(input.amountMinor), currency: input.currency, reference: input.reference, callback_url: input.callbackUrl, metadata: input.metadata }) });
    const payload = await responseObject(response);
    const data = nestedObject(payload.data);
    const checkoutUrl = typeof data.authorization_url === "string" ? data.authorization_url : "";
    if (!response.ok || !checkoutUrl) throw new HostedCheckoutError("Paystack could not initialize this checkout");
    return { checkoutUrl, providerReference: typeof data.reference === "string" ? data.reference : undefined, raw: payload };
  }
  if (provider === "flutterwave") {
    response = await fetch("https://api.flutterwave.com/v3/payments", { method: "POST", headers: { ...commonHeaders, Authorization: `Bearer ${providerApiSecrets.flutterwave}` }, body: JSON.stringify({ tx_ref: input.reference, amount: input.amountMinor / 100, currency: input.currency, redirect_url: input.callbackUrl, customer: { email: input.email, name: input.customerName }, meta: input.metadata }) });
    const payload = await responseObject(response);
    const data = nestedObject(payload.data);
    const checkoutUrl = typeof data.link === "string" ? data.link : "";
    if (!response.ok || !checkoutUrl) throw new HostedCheckoutError("Flutterwave could not initialize this checkout");
    return { checkoutUrl, providerReference: typeof data.tx_ref === "string" ? data.tx_ref : undefined, raw: payload };
  }
  const apiKey = process.env.MONNIFY_API_KEY;
  const contractCode = process.env.MONNIFY_CONTRACT_CODE;
  if (!apiKey || !contractCode) throw new HostedCheckoutError("Monnify requires MONNIFY_API_KEY and MONNIFY_CONTRACT_CODE", 503);
  const baseUrl = process.env.MONNIFY_BASE_URL ?? "https://sandbox.monnify.com";
  const tokenResponse = await fetch(`${baseUrl}/api/v1/auth/login`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${providerApiSecrets.monnify}`).toString("base64")}` } });
  const tokenPayload = await responseObject(tokenResponse);
  const tokenData = nestedObject(tokenPayload.responseBody);
  const accessToken = typeof tokenData.accessToken === "string" ? tokenData.accessToken : "";
  if (!tokenResponse.ok || !accessToken) throw new HostedCheckoutError("Monnify authentication failed");
  response = await fetch(`${baseUrl}/api/v1/merchant/transactions/init-transaction`, { method: "POST", headers: { ...commonHeaders, Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ amount: input.amountMinor / 100, customerName: input.customerName, customerEmail: input.email, paymentReference: input.reference, paymentDescription: "MarketFlow checkout", currencyCode: input.currency, contractCode, redirectUrl: input.callbackUrl, incomeSplitConfig: [], metaData: input.metadata }) });
  const payload = await responseObject(response);
  const data = nestedObject(payload.responseBody);
  const checkoutUrl = typeof data.checkoutUrl === "string" ? data.checkoutUrl : "";
  if (!response.ok || !checkoutUrl) throw new HostedCheckoutError("Monnify could not initialize this checkout");
  return { checkoutUrl, providerReference: typeof data.paymentReference === "string" ? data.paymentReference : undefined, raw: payload };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isPaymentProvider(value: string): value is PaymentProvider {
  return value === "paystack" || value === "flutterwave" || value === "monnify";
}

export function verifyWebhookSignature(provider: PaymentProvider, rawBody: string, headers: Headers) {
  const secret = webhookSecrets[provider];
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
