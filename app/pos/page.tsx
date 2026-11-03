"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../components/theme-toggle";

type Product = { id: string; name: string; sku: string; priceMinor: number; currency: string; category?: { name: string } | null; barcodes?: { value: string }[]; balances?: { quantity: number }[] };
type CartLine = Product & { quantity: number };

const previewProducts: Product[] = [
  { id: "preview-golden-penny", name: "Golden Penny Spaghetti 500g", sku: "GP-SPAG-500", priceMinor: 185000, currency: "NGN", category: { name: "Groceries" }, balances: [{ quantity: 24 }] },
  { id: "preview-peak-milk", name: "Peak Milk Sachet 60g", sku: "PEAK-MLK-60", priceMinor: 35000, currency: "NGN", category: { name: "Dairy" }, balances: [{ quantity: 8 }] },
  { id: "preview-cway-water", name: "Cway Table Water 75cl", sku: "CWAY-75CL", priceMinor: 25000, currency: "NGN", category: { name: "Beverages" }, balances: [{ quantity: 62 }] },
  { id: "preview-power-oil", name: "Power Oil 750ml", sku: "PWR-OIL-750", priceMinor: 245000, currency: "NGN", category: { name: "Cooking oil" }, balances: [{ quantity: 5 }] },
  { id: "preview-indomie", name: "Indomie Chicken Noodles", sku: "IND-CHK-70", priceMinor: 7500, currency: "NGN", category: { name: "Groceries" }, balances: [{ quantity: 48 }] },
  { id: "preview-rice", name: "Golden Penny Rice 5kg", sku: "GP-RICE-5KG", priceMinor: 780000, currency: "NGN", category: { name: "Groceries" }, balances: [{ quantity: 13 }] }
];

const money = (minor: number) => `₦${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(Math.round(minor / 100))}`;

export default function PointOfSalePage() {
  const [products, setProducts] = useState<Product[]>(previewProducts);
  const [isPreviewCatalog, setIsPreviewCatalog] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All products");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastReference, setLastReference] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ products: Product[] }>;
      })
      .then((data) => {
        if (cancelled || !data) return;
        setProducts(data.products);
        setIsPreviewCatalog(false);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => ["All products", ...new Set(products.map((product) => product.category?.name).filter(Boolean) as string[])], [products]);
  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesQuery = `${product.name} ${product.sku} ${product.barcodes?.map((barcode) => barcode.value).join(" ") ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === "All products" || product.category?.name === category);
  }), [category, products, query]);
  const subtotal = cart.reduce((sum, line) => sum + line.priceMinor * line.quantity, 0);
  const change = Math.max(0, (Number(amountTendered) || 0) * 100 - subtotal);

  const addToCart = (product: Product) => {
    setError("");
    setMessage("");
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) return current.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => setCart((current) => current.map((line) => line.id === id ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0));

  const completeSale = async () => {
    setError("");
    setMessage("");
    if (!cart.length) return setError("Add at least one product to the cart.");
    if (isPreviewCatalog) return setError("Sign in to a merchant workspace to complete a live sale. This is a preview catalog.");
    if (amountTendered && Number(amountTendered) * 100 < subtotal) return setError("Amount tendered is less than the total.");
    setBusy(true);
    try {
      const response = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ items: cart.map((line) => ({ productId: line.id, quantity: line.quantity })), paymentMethod, amountTenderedMinor: amountTendered ? Number(amountTendered) * 100 : undefined }) });
      const data = await response.json() as { error?: string; sale?: { reference: string } };
      if (!response.ok) throw new Error(data.error ?? "Unable to complete sale");
      setLastReference(data.sale?.reference ?? "");
      setCart([]);
      setAmountTendered("");
      setShowReceipt(true);
      setMessage("Sale completed and inventory updated.");
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to complete sale");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="pos-shell">
      <header className="pos-topbar">
        <div className="pos-brand-row"><Link href="/" className="brand"><div className="brand-mark"><span></span><span></span><span></span></div><span>market<span className="brand-accent">flow</span></span></Link><span className="pos-divider"></span><span className="pos-title">Point of sale</span></div>
        <div className="pos-top-actions"><span className="pos-register"><i></i> Main Store · Register 01</span><ThemeToggle/><Link href="/" className="pos-back">Exit POS</Link></div>
      </header>
      <div className="pos-content">
        <section className="pos-catalog panel">
          <div className="pos-heading"><div><p className="eyebrow">CASHIER WORKSPACE</p><h1>Start a new sale</h1><p className="muted">Scan a barcode or search your product catalogue.</p></div><div className="pos-shortcuts"><span><kbd>⌘</kbd> + <kbd>K</kbd> Search</span><span><kbd>⌘</kbd> + <kbd>Enter</kbd> Pay</span></div></div>
          {isPreviewCatalog && <div className="pos-preview-note">Preview catalog — sign in to load your workspace products and complete live sales. <Link href="/login">Sign in</Link></div>}
          <div className="pos-search-row"><div className="pos-search"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by product name, SKU or barcode" aria-label="Search products"/><kbd>/</kbd></div><button className="secondary-button">▣ Scan barcode</button></div>
          <div className="pos-categories" aria-label="Product categories">{categories.map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className="pos-product-grid">{visibleProducts.map((product) => { const stock = product.balances?.[0]?.quantity ?? 0; return <button className="pos-product-card" key={product.id} onClick={() => addToCart(product)}><span className="pos-product-art"></span><span className="pos-product-info"><strong>{product.name}</strong><small>{product.sku} · {stock} in stock</small></span><span className="pos-product-price">{money(product.priceMinor)}</span></button>; })}</div>
          {!visibleProducts.length && <div className="pos-empty"><strong>No products found</strong><span>Try a different search or category.</span></div>}
        </section>
        <aside className="pos-cart panel">
          <div className="pos-cart-heading"><div><p className="eyebrow">CURRENT ORDER</p><h2>Cart <span>{cart.reduce((sum, line) => sum + line.quantity, 0)}</span></h2></div><button className="text-button" onClick={() => setCart([])} disabled={!cart.length}>Clear</button></div>
          <div className="pos-cart-lines">{cart.map((line) => <div className="pos-cart-line" key={line.id}><div><strong>{line.name}</strong><small>{money(line.priceMinor)} each</small></div><div className="pos-quantity"><button onClick={() => updateQuantity(line.id, -1)} aria-label={`Decrease ${line.name}`}>−</button><span>{line.quantity}</span><button onClick={() => updateQuantity(line.id, 1)} aria-label={`Increase ${line.name}`}>+</button></div><b>{money(line.priceMinor * line.quantity)}</b></div>)}{!cart.length && <div className="pos-cart-empty"><span className="pos-cart-icon">◌</span><strong>Your cart is empty</strong><small>Select products to begin a sale.</small></div>}</div>
          <div className="pos-summary"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Tax</span><b>₦0</b></div><div className="pos-total"><span>Total</span><b>{money(subtotal)}</b></div></div>
          <div className="pos-payment"><p className="eyebrow">PAYMENT METHOD</p><div className="pos-payment-options">{[["cash", "Cash", "▣"], ["card", "Card", "▰"], ["bank_transfer", "Transfer", "↗"]].map(([value, label, icon]) => <button key={value} className={paymentMethod === value ? "selected" : ""} onClick={() => setPaymentMethod(value)} disabled={value !== "cash"}><span>{icon}</span>{label}{value !== "cash" && <small>Soon</small>}</button>)}</div>{paymentMethod === "cash" && <label className="pos-tendered">Amount tendered<input inputMode="decimal" value={amountTendered} onChange={(event) => setAmountTendered(event.target.value.replace(/[^0-9.]/g, ""))} placeholder={subtotal ? String(Math.ceil(subtotal / 100)) : "0"}/><span>Change {money(change)}</span></label>}</div>
          {error && <p className="pos-message error">{error}</p>}{message && <p className="pos-message success">{message}</p>}
          <button className="primary-button pos-pay" onClick={completeSale} disabled={busy || !cart.length}>{busy ? "Processing…" : `Complete cash sale · ${money(subtotal)}`}</button>
        </aside>
      </div>
      {showReceipt && <div className="pos-receipt-overlay" role="dialog" aria-modal="true"><div className="pos-receipt"><span className="pos-receipt-check">✓</span><p className="eyebrow">PAYMENT CONFIRMED</p><h2>Sale completed</h2><p>Your inventory has been updated and the receipt is ready.</p><strong>{lastReference}</strong><div><button className="secondary-button" onClick={() => window.print()}>Print receipt</button><button className="primary-button" onClick={() => setShowReceipt(false)}>Done</button></div></div></div>}
    </main>
  );
}
