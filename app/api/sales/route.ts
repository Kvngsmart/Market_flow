import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

const checkoutSchema = z.object({
  items: z.array(z.object({ productId: z.string().cuid(), quantity: z.number().int().positive().max(10000) })).min(1).max(100),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "pos_terminal"]).default("cash"),
  amountTenderedMinor: z.number().int().nonnegative().optional(),
  discountMinor: z.number().int().nonnegative().default(0),
  taxMinor: z.number().int().nonnegative().default(0),
  idempotencyKey: z.string().trim().min(8).max(120).optional()
});

export async function GET(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 20) || 20, 100);
  const sales = await prisma.sale.findMany({
    where: { businessId: context.business.id, branchId: context.branch?.id },
    include: { items: { include: { product: true } }, payments: true },
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return NextResponse.json({ sales });
}

export async function POST(request: Request) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!context.branch) return NextResponse.json({ error: "Create an active branch before taking sales" }, { status: 409 });

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid checkout details", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if (input.paymentMethod !== "cash") return NextResponse.json({ error: "This checkout currently accepts verified cash payments only" }, { status: 422 });

  const itemsByProduct = new Map<string, number>();
  for (const item of input.items) itemsByProduct.set(item.productId, (itemsByProduct.get(item.productId) ?? 0) + item.quantity);
  const items = [...itemsByProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  const idempotencyKey = input.idempotencyKey ?? request.headers.get("Idempotency-Key") ?? randomUUID();

  const existing = await prisma.sale.findUnique({ where: { idempotencyKey }, include: { items: true, payments: true } });
  if (existing) return NextResponse.json({ sale: existing, duplicate: true });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const products = [] as Array<{ id: string; name: string; priceMinor: number; costMinor: number }>;
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || !product.active || product.businessId !== context.business.id) throw new CheckoutError("A product is unavailable in this workspace", 400);
        products.push(product);
      }

      const subtotalMinor = products.reduce((sum, product, index) => sum + product.priceMinor * items[index].quantity, 0);
      if (input.discountMinor > subtotalMinor) throw new CheckoutError("Discount cannot exceed the subtotal", 400);
      const totalMinor = subtotalMinor - input.discountMinor + input.taxMinor;
      if (input.amountTenderedMinor !== undefined && input.amountTenderedMinor < totalMinor) throw new CheckoutError("Amount tendered is less than the total", 400);

      for (const item of items) {
        const updated = await tx.inventoryBalance.updateMany({
          where: { branchId: context.branch!.id, productId: item.productId, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } }
        });
        if (updated.count !== 1) throw new CheckoutError("One or more products do not have enough stock", 409);
      }

      const sale = await tx.sale.create({
        data: {
          businessId: context.business.id,
          branchId: context.branch.id,
          cashierId: context.user.id,
          reference: `MF-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
          subtotalMinor,
          discountMinor: input.discountMinor,
          taxMinor: input.taxMinor,
          totalMinor,
          idempotencyKey,
          items: { create: items.map((item, index) => ({ productId: item.productId, quantity: item.quantity, unitPriceMinor: products[index].priceMinor, costMinor: products[index].costMinor })) },
          payments: { create: { status: "SUCCEEDED", method: "cash", amountMinor: totalMinor } }
        },
        include: { items: true, payments: true }
      });

      for (const item of items) {
        await tx.inventoryMovement.create({ data: { businessId: context.business.id, branchId: context.branch!.id, productId: item.productId, type: "SALE", quantity: -item.quantity, reference: sale.reference } });
      }
      await tx.auditLog.create({ data: { businessId: context.business.id, userId: context.user.id, action: "CREATE", entity: "Sale", entityId: sale.id, metadata: { reference: sale.reference, totalMinor } } });
      return sale;
    });
    return NextResponse.json({ sale: result }, { status: 201 });
  } catch (error) {
    if (error instanceof CheckoutError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") {
      const duplicate = await prisma.sale.findUnique({ where: { idempotencyKey }, include: { items: true, payments: true } });
      if (duplicate) return NextResponse.json({ sale: duplicate, duplicate: true });
    }
    return NextResponse.json({ error: "Unable to complete checkout" }, { status: 500 });
  }
}

class CheckoutError extends Error {
  constructor(message: string, public status: 400 | 409) {
    super(message);
  }
}
