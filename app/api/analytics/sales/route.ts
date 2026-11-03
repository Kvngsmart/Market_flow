import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export async function GET(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const requestedDays = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const days = [7, 30, 90, 365].includes(requestedDays) ? requestedDays : 30;
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sales = await prisma.sale.findMany({ where: { businessId: context.business.id, branchId: context.branch?.id, createdAt: { gte: start } }, include: { items: { include: { product: { include: { category: true } } } }, payments: true }, orderBy: { createdAt: "asc" } });
  const completed = sales.filter((sale) => sale.status === "COMPLETED");
  const revenueMinor = completed.reduce((sum, sale) => sum + sale.totalMinor, 0);
  const grossProfitMinor = completed.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + (item.unitPriceMinor - item.costMinor) * item.quantity, 0), 0);
  const refundMinor = sales.filter((sale) => sale.status === "REFUNDED").reduce((sum, sale) => sum + sale.totalMinor, 0);
  const trend = new Map<string, { label: string; valueMinor: number; orders: number }>();
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    trend.set(key, { label: new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short" }).format(date), valueMinor: 0, orders: 0 });
  }
  for (const sale of completed) {
    const key = sale.createdAt.toISOString().slice(0, 10);
    const day = trend.get(key);
    if (day) { day.valueMinor += sale.totalMinor; day.orders += 1; }
  }
  const productTotals = new Map<string, { name: string; quantity: number; revenueMinor: number }>();
  const paymentTotals = new Map<string, number>();
  for (const sale of completed) {
    for (const item of sale.items) {
      const current = productTotals.get(item.productId) ?? { name: item.product.name, quantity: 0, revenueMinor: 0 };
      current.quantity += item.quantity; current.revenueMinor += item.unitPriceMinor * item.quantity; productTotals.set(item.productId, current);
    }
    for (const payment of sale.payments.filter((payment) => payment.status === "SUCCEEDED")) paymentTotals.set(payment.method, (paymentTotals.get(payment.method) ?? 0) + payment.amountMinor);
  }
  return NextResponse.json({
    rangeDays: days,
    metrics: { revenueMinor, transactions: completed.length, averageOrderMinor: completed.length ? Math.round(revenueMinor / completed.length) : 0, grossProfitMinor, refundMinor },
    trend: [...trend.values()],
    topProducts: [...productTotals.entries()].map(([productId, value]) => ({ productId, ...value })).sort((a, b) => b.revenueMinor - a.revenueMinor).slice(0, 8),
    paymentMethods: [...paymentTotals.entries()].map(([method, amountMinor]) => ({ method, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor)
  });
}
