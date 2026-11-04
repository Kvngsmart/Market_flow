import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { paymentProviders } from "@/lib/payments";

export async function GET() {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.json({ currency: context.business.currency, providers: paymentProviders });
}
