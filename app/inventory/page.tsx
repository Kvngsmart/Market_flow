"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import ThemeToggle from "../components/theme-toggle";

type Category = { id: string; name: string };
type Product = { id: string; name: string; sku: string; priceMinor: number; costMinor: number; category?: Category | null; barcodes: { value: string }[]; balances: { quantity: number }[] };

const previewProducts: Product[] = [
  { id: "preview-golden-penny", name: "Golden Penny Spaghetti 500g", sku: "GP-SPAG-500", priceMinor: 185000, costMinor: 158000, category: { id: "groceries", name: "Groceries" }, barcodes: [{ value: "615110123001" }], balances: [{ quantity: 24 }] },
  { id: "preview-peak-milk", name: "Peak Milk Sachet 60g", sku: "PEAK-MLK-60", priceMinor: 35000, costMinor: 29000, category: { id: "dairy", name: "Dairy" }, barcodes: [{ value: "615110234002" }], balances: [{ quantity: 8 }] },
  { id: "preview-cway-water", name: "Cway Table Water 75cl", sku: "CWAY-75CL", priceMinor: 25000, costMinor: 18000, category: { id: "beverages", name: "Beverages" }, barcodes: [{ value: "615110345003" }], balances: [{ quantity: 62 }] },
  { id: "preview-power-oil", name: "Power Oil 750ml", sku: "PWR-OIL-750", priceMinor: 245000, costMinor: 211000, category: { id: "cooking-oil", name: "Cooking oil" }, barcodes: [{ value: "615110456004" }], balances: [{ quantity: 5 }] }
];

const money = (minor: number) => `₦${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(Math.round(minor / 100))}`;

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>(previewProducts);
  const [categories, setCategories] = useState<Category[]>([]);
  const [preview, setPreview] = useState(true);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<"product" | "stock" | "edit" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", sku: "", categoryId: "", cost: "", price: "", openingQuantity: "", barcodes: "" });
  const [editForm, setEditForm] = useState({ id: "", name: "", sku: "", categoryId: "", cost: "", price: "", reorderLevel: "", barcodes: "" });
  const [stockForm, setStockForm] = useState({ productId: "", type: "RECEIPT", quantity: "", reference: "" });

  const refresh = async () => {
    const [productResponse, categoryResponse] = await Promise.all([fetch("/api/products"), fetch("/api/categories")]);
    if (!productResponse.ok) return;
    const productData = await productResponse.json() as { products: Product[] };
    const categoryData = categoryResponse.ok ? await categoryResponse.json() as { categories: Category[] } : { categories: [] };
    setProducts(productData.products);
    setCategories(categoryData.categories);
    setPreview(false);
  };

  useEffect(() => { refresh().catch(() => undefined); }, []);

  const visibleProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku} ${product.barcodes.map((barcode) => barcode.value).join(" ")}`.toLowerCase().includes(query.toLowerCase())), [products, query]);

  const submitProduct = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: productForm.name, sku: productForm.sku, categoryId: productForm.categoryId || undefined, costMinor: Math.round(Number(productForm.cost) * 100), priceMinor: Math.round(Number(productForm.price) * 100), openingQuantity: Math.max(0, Math.round(Number(productForm.openingQuantity) || 0)), barcodes: productForm.barcodes.split(",").map((value) => value.trim()).filter(Boolean) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to create product");
      setPanel(null); setProductForm({ name: "", sku: "", categoryId: "", cost: "", price: "", openingQuantity: "", barcodes: "" }); setNotice("Product added to your catalogue."); await refresh();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to create product"); } finally { setBusy(false); }
  };

  const submitStock = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/inventory/adjustments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...stockForm, quantity: Number(stockForm.quantity) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to update stock");
      setPanel(null); setStockForm({ productId: "", type: "RECEIPT", quantity: "", reference: "" }); setNotice("Inventory balance updated."); await refresh();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to update stock"); } finally { setBusy(false); }
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/products/${editForm.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editForm.name, sku: editForm.sku, categoryId: editForm.categoryId || null, costMinor: Math.round(Number(editForm.cost) * 100), priceMinor: Math.round(Number(editForm.price) * 100), reorderLevel: Math.max(0, Math.round(Number(editForm.reorderLevel) || 0)), barcodes: editForm.barcodes.split(",").map((value) => value.trim()).filter(Boolean) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to update product");
      setPanel(null); setNotice("Product details updated."); await refresh();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to update product"); } finally { setBusy(false); }
  };

  const editProduct = (product: Product) => {
    setEditForm({ id: product.id, name: product.name, sku: product.sku, categoryId: product.category?.id ?? "", cost: String(product.costMinor / 100), price: String(product.priceMinor / 100), reorderLevel: "0", barcodes: product.barcodes.map((barcode) => barcode.value).join(", ") });
    setPanel("edit"); setError("");
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/products/import", { method: "POST", headers: { "Content-Type": "text/csv" }, body: await file.text() });
      const data = await response.json() as { error?: string; imported?: number; failed?: number };
      if (!response.ok && response.status !== 207) throw new Error(data.error ?? "Unable to import products");
      setNotice(`${data.imported ?? 0} products imported${data.failed ? `; ${data.failed} rows need attention` : ""}.`); await refresh();
    } catch (importError) { setError(importError instanceof Error ? importError.message : "Unable to import products"); } finally { setBusy(false); event.target.value = ""; }
  };

  return (
    <main className="inventory-shell">
      <header className="inventory-topbar"><div className="inventory-brand-row"><Link href="/" className="brand"><div className="brand-mark"><span></span><span></span><span></span></div><span>market<span className="brand-accent">flow</span></span></Link><span className="inventory-divider"></span><span className="inventory-title">Inventory</span></div><div className="inventory-top-actions"><Link href="/branches" className="inventory-branch"><i></i> Main Store ↗</Link><ThemeToggle/><Link href="/" className="inventory-back">Back to overview</Link></div></header>
      <div className="inventory-content"><div className="inventory-heading"><div><p className="eyebrow">CATALOGUE & STOCK</p><h1>Inventory</h1><p className="muted">Keep products, barcodes, and branch stock in sync.</p></div><div className="inventory-actions"><label className="secondary-button inventory-import">Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} disabled={busy}/></label><button className="secondary-button" onClick={() => setPanel("stock")}>＋ Adjust stock</button><button className="primary-button" onClick={() => setPanel("product")}>＋ Add product</button></div></div>
        {preview && <div className="inventory-preview-note">Preview catalogue — sign in to manage live products and stock. <Link href="/login">Sign in</Link></div>}
        {notice && <p className="inventory-notice success">{notice}</p>}{error && <p className="inventory-notice error">{error}</p>}
        <div className="inventory-kpis"><div className="inventory-kpi"><span>Total products</span><strong>{products.length}</strong><small>Across your catalogue</small></div><div className="inventory-kpi"><span>Units in stock</span><strong>{products.reduce((sum, product) => sum + (product.balances[0]?.quantity ?? 0), 0)}</strong><small>Current branch balance</small></div><div className="inventory-kpi"><span>Low stock</span><strong>{products.filter((product) => (product.balances[0]?.quantity ?? 0) <= 8).length}</strong><small>Needs attention</small></div><div className="inventory-kpi"><span>Catalogue value</span><strong>{money(products.reduce((sum, product) => sum + product.costMinor * (product.balances[0]?.quantity ?? 0), 0))}</strong><small>At cost price</small></div></div>
        <section className="inventory-panel panel"><div className="inventory-panel-heading"><div><h2>Products</h2><p className="muted">Search by name, SKU, or any registered barcode.</p></div><div className="inventory-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" aria-label="Search inventory"/></div></div><div className="inventory-table"><div className="inventory-row inventory-row-head"><span>Product</span><span>Category</span><span>Price</span><span>In stock</span><span>Barcodes</span><span></span></div>{visibleProducts.map((product) => { const stock = product.balances[0]?.quantity ?? 0; return <div className="inventory-row" key={product.id}><div className="inventory-product"><span className="inventory-art"></span><span><strong>{product.name}</strong><small>{product.sku}</small></span></div><span className="inventory-category">{product.category?.name ?? "Uncategorised"}</span><strong>{money(product.priceMinor)}</strong><span className={stock <= 8 ? "inventory-stock low" : "inventory-stock"}>{stock} units</span><span className="inventory-barcodes">{product.barcodes.length} barcode{product.barcodes.length === 1 ? "" : "s"}</span><button className="inventory-more" onClick={() => editProduct(product)} aria-label={`Edit ${product.name}`}>•••</button></div>; })}</div>{!visibleProducts.length && <div className="inventory-empty">No products match your search.</div>}</section>
      </div>
      {panel && <div className="inventory-overlay"><section className="inventory-drawer" role="dialog" aria-modal="true"><div className="inventory-drawer-head"><div><p className="eyebrow">{panel === "product" ? "NEW CATALOGUE ITEM" : panel === "edit" ? "EDIT CATALOGUE ITEM" : "INVENTORY MOVEMENT"}</p><h2>{panel === "product" ? "Add product" : panel === "edit" ? "Edit product" : "Adjust stock"}</h2></div><button className="inventory-close" onClick={() => setPanel(null)} aria-label="Close">×</button></div>{panel === "product" ? <form className="inventory-form" onSubmit={submitProduct}><label>Product name<input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="e.g. Indomie Chicken Noodles"/></label><label>SKU<input required value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} placeholder="e.g. IND-CHK-70"/></label><label>Category<select value={productForm.categoryId} onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="inventory-form-grid"><label>Cost price (₦)<input required min="0" step="0.01" type="number" value={productForm.cost} onChange={(event) => setProductForm({ ...productForm, cost: event.target.value })}/></label><label>Selling price (₦)<input required min="0" step="0.01" type="number" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })}/></label></div><div className="inventory-form-grid"><label>Opening quantity<input min="0" type="number" value={productForm.openingQuantity} onChange={(event) => setProductForm({ ...productForm, openingQuantity: event.target.value })}/></label><label>Barcodes<input value={productForm.barcodes} onChange={(event) => setProductForm({ ...productForm, barcodes: event.target.value })} placeholder="Comma separated"/></label></div><button className="primary-button inventory-submit" disabled={busy}>{busy ? "Saving…" : "Save product"}</button></form> : panel === "edit" ? <form className="inventory-form" onSubmit={submitEdit}><label>Product name<input required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}/></label><label>SKU<input required value={editForm.sku} onChange={(event) => setEditForm({ ...editForm, sku: event.target.value })}/></label><label>Category<select value={editForm.categoryId} onChange={(event) => setEditForm({ ...editForm, categoryId: event.target.value })}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="inventory-form-grid"><label>Cost price (₦)<input required min="0" step="0.01" type="number" value={editForm.cost} onChange={(event) => setEditForm({ ...editForm, cost: event.target.value })}/></label><label>Selling price (₦)<input required min="0" step="0.01" type="number" value={editForm.price} onChange={(event) => setEditForm({ ...editForm, price: event.target.value })}/></label></div><div className="inventory-form-grid"><label>Reorder level<input min="0" type="number" value={editForm.reorderLevel} onChange={(event) => setEditForm({ ...editForm, reorderLevel: event.target.value })}/></label><label>Barcodes<input value={editForm.barcodes} onChange={(event) => setEditForm({ ...editForm, barcodes: event.target.value })} placeholder="Comma separated"/></label></div><button className="primary-button inventory-submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></form> : <form className="inventory-form" onSubmit={submitStock}><label>Product<select required value={stockForm.productId} onChange={(event) => setStockForm({ ...stockForm, productId: event.target.value })}><option value="">Select a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Movement type<select value={stockForm.type} onChange={(event) => setStockForm({ ...stockForm, type: event.target.value })}><option value="RECEIPT">Receive stock</option><option value="ADJUSTMENT">Manual adjustment</option><option value="DAMAGE">Damaged stock</option><option value="EXPIRY">Expired stock</option></select></label><label>Quantity<input required min="1" type="number" value={stockForm.quantity} onChange={(event) => setStockForm({ ...stockForm, quantity: event.target.value })} placeholder="0"/></label><label>Reference (optional)<input value={stockForm.reference} onChange={(event) => setStockForm({ ...stockForm, reference: event.target.value })} placeholder="e.g. Supplier delivery #104"/></label><button className="primary-button inventory-submit" disabled={busy}>{busy ? "Saving…" : "Update inventory"}</button></form>}</section></div>}
    </main>
  );
}
