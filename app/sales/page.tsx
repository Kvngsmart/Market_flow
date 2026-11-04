"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../components/theme-toggle";

type SaleItem = { productId: string; quantity: number; unitPriceMinor: number; product?: { name: string } };
type Sale = { id: string; reference: string; status: "COMPLETED" | "REFUNDED" | "VOIDED"; subtotalMinor: number; totalMinor: number; createdAt: string; items: SaleItem[]; payments: { method: string; amountMinor: number; status: string }[] };

const previewSales: Sale[] = [
  { id: "preview-sale-1", reference: "MF-2JH9Q1-8A3B", status: "COMPLETED", subtotalMinor: 4850000, totalMinor: 4850000, createdAt: "2026-11-03T12:20:00.000Z", items: [{ productId: "p1", quantity: 2, unitPriceMinor: 1850000, product: { name: "Golden Penny Spaghetti 500g" } }, { productId: "p2", quantity: 1, unitPriceMinor: 1150000, product: { name: "Power Oil 750ml" } }], payments: [{ method: "cash", amountMinor: 4850000, status: "SUCCEEDED" }] },
  { id: "preview-sale-2", reference: "MF-2JH7P4-3C1D", status: "COMPLETED", subtotalMinor: 1220000, totalMinor: 1220000, createdAt: "2026-11-03T10:43:00.000Z", items: [{ productId: "p3", quantity: 4, unitPriceMinor: 305000, product: { name: "Peak Milk Sachet 60g" } }], payments: [{ method: "cash", amountMinor: 1220000, status: "SUCCEEDED" }] },
  { id: "preview-sale-3", reference: "MF-2JGZQ7-5F2A", status: "REFUNDED", subtotalMinor: 3500000, totalMinor: 3500000, createdAt: "2026-11-02T16:18:00.000Z", items: [{ productId: "p4", quantity: 1, unitPriceMinor: 3500000, product: { name: "Golden Penny Rice 5kg" } }], payments: [{ method: "cash", amountMinor: 3500000, status: "REFUNDED" }] }
];

const money = (minor: number) => `₦${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(Math.round(minor / 100))}`;
const dateTime = (value: string) => new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>(previewSales);
  const [preview, setPreview] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All sales");
  const [selected, setSelected] = useState<Sale | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/sales?limit=100").then(async (response) => { if (!response.ok) return null; return response.json() as Promise<{ sales: Sale[] }>; }).then((data) => { if (data) { setSales(data.sales); setPreview(false); } }).catch(() => undefined);
  }, []);

  const visibleSales = useMemo(() => sales.filter((sale) => {
    const matchesQuery = `${sale.reference} ${sale.items.map((item) => item.product?.name ?? "").join(" ")}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "All sales" || sale.status === status);
  }), [query, sales, status]);

  const refund = async () => {
    if (!selected || preview) return setError("Sign in to a merchant workspace to process a live refund.");
    if (!window.confirm(`Refund ${selected.reference}? The items will be returned to stock.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/sales/${selected.id}/refund`, { method: "POST" });
      const data = await response.json() as { error?: string; sale?: Sale };
      if (!response.ok) throw new Error(data.error ?? "Unable to refund sale");
      setSales((current) => current.map((sale) => sale.id === selected.id ? { ...sale, status: "REFUNDED", payments: sale.payments.map((payment) => ({ ...payment, status: "REFUNDED" })) } : sale));
      setSelected(null); setNotice("Sale refunded and items returned to inventory.");
    } catch (refundError) { setError(refundError instanceof Error ? refundError.message : "Unable to refund sale"); } finally { setBusy(false); }
  };

  return (
    <main className="sales-shell"><header className="sales-topbar"><div className="sales-brand-row"><Link href="/" className="brand"><div className="brand-mark"><span></span><span></span><span></span></div><span>market<span className="brand-accent">flow</span></span></Link><span className="sales-divider"></span><span className="sales-title">Sales & receipts</span></div><div className="sales-top-actions"><ThemeToggle/><Link href="/pos" className="primary-button">＋ New sale</Link><Link href="/" className="sales-back">Back to overview</Link></div></header>
      <div className="sales-content"><div className="sales-heading"><div><p className="eyebrow">TRANSACTIONS</p><h1>Sales & receipts</h1><p className="muted">Review completed sales, reprint receipts, and manage returns.</p></div></div>{preview && <div className="sales-preview-note">Preview receipts — sign in to load your workspace transactions. <Link href="/login">Sign in</Link></div>}{notice && <p className="sales-notice success">{notice}</p>}{error && <p className="sales-notice error">{error}</p>}
        <section className="sales-panel panel"><div className="sales-panel-heading"><div><h2>Recent sales</h2><p className="muted">Cashier transactions from Main Store</p></div><div className="sales-filters"><div className="sales-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference or product" aria-label="Search sales"/></div><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter sales"><option>All sales</option><option value="COMPLETED">Completed</option><option value="REFUNDED">Refunded</option></select></div></div><div className="sales-table"><div className="sales-row sales-row-head"><span>Reference</span><span>Items</span><span>Payment</span><span>Status</span><span>Total</span><span></span></div>{visibleSales.map((sale) => <button className="sales-row sales-row-button" key={sale.id} onClick={() => setSelected(sale)}><span><strong>{sale.reference}</strong><small>{dateTime(sale.createdAt)}</small></span><span>{sale.items.reduce((sum, item) => sum + item.quantity, 0)} items</span><span className="sales-method">{sale.payments[0]?.method === "cash" ? "Cash" : sale.payments[0]?.method ?? "—"}</span><span><em className={`sales-status ${sale.status.toLowerCase()}`}>{sale.status === "COMPLETED" ? "Completed" : sale.status === "REFUNDED" ? "Refunded" : "Voided"}</em></span><strong>{money(sale.totalMinor)}</strong><span className="sales-chevron">›</span></button>)}</div>{!visibleSales.length && <div className="sales-empty">No sales match your filters.</div>}</section>
      </div>{selected && <div className="sales-overlay"><section className="sales-receipt" role="dialog" aria-modal="true"><div className="sales-receipt-head"><div><p className="eyebrow">RECEIPT</p><h2>{selected.reference}</h2><small>{dateTime(selected.createdAt)} · Main Store</small></div><button className="sales-close" onClick={() => setSelected(null)} aria-label="Close">×</button></div><div className="sales-receipt-items">{selected.items.map((item) => <div key={item.productId}><span>{item.product?.name ?? "Product"} <small>×{item.quantity}</small></span><b>{money(item.unitPriceMinor * item.quantity)}</b></div>)}</div><div className="sales-receipt-total"><span>Total paid</span><strong>{money(selected.totalMinor)}</strong></div><div className="sales-receipt-meta"><span>Payment method <b>{selected.payments[0]?.method === "cash" ? "Cash" : selected.payments[0]?.method}</b></span><span>Status <b>{selected.status === "REFUNDED" ? "Refunded" : "Completed"}</b></span></div><div className="sales-receipt-actions"><button className="secondary-button" onClick={() => window.print()}>Print receipt</button>{selected.status === "COMPLETED" && <button className="danger-button" disabled={busy} onClick={refund}>{busy ? "Refunding…" : "Refund sale"}</button>}</div></section></div>}
    </main>
  );
}
