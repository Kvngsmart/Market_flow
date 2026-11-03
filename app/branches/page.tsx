"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import ThemeToggle from "../components/theme-toggle";

type Branch = { id: string; name: string; address?: string | null; summary: { units: number; products: number } };
type Product = { id: string; name: string; sku: string; balances: { quantity: number }[] };

const previewBranches: Branch[] = [
  { id: "preview-main", name: "Main Store", address: "Ikeja, Lagos", summary: { units: 99, products: 4 } },
  { id: "preview-lekki", name: "Lekki Express", address: "Admiralty Way, Lagos", summary: { units: 42, products: 3 } }
];
const previewProducts: Product[] = [
  { id: "preview-spag", name: "Golden Penny Spaghetti 500g", sku: "GP-SPAG-500", balances: [{ quantity: 24 }] },
  { id: "preview-milk", name: "Peak Milk Sachet 60g", sku: "PEAK-MLK-60", balances: [{ quantity: 8 }] }
];

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>(previewBranches);
  const [products, setProducts] = useState<Product[]>(previewProducts);
  const [selectedBranchId, setSelectedBranchId] = useState("preview-main");
  const [preview, setPreview] = useState(true);
  const [panel, setPanel] = useState<"branch" | "transfer" | null>(null);
  const [branchForm, setBranchForm] = useState({ name: "", address: "" });
  const [transferForm, setTransferForm] = useState({ productId: "", toBranchId: "", quantity: "", reference: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const response = await fetch("/api/branches");
    if (!response.ok) { setPreview(true); return; }
    const data = await response.json() as { branches: Branch[]; selectedBranchId: string | null };
    setBranches(data.branches); setSelectedBranchId(data.selectedBranchId ?? data.branches[0]?.id ?? ""); setPreview(false);
    const productsResponse = await fetch("/api/products");
    if (productsResponse.ok) { const productData = await productsResponse.json() as { products: Product[] }; setProducts(productData.products); }
  };

  useEffect(() => { void refresh(); }, []);

  const selectBranch = async (branchId: string) => {
    setError(""); setNotice("");
    if (preview) { setSelectedBranchId(branchId); setNotice("Preview branch selected. Sign in to switch live workspace stock."); return; }
    const response = await fetch("/api/branches/select", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setError(data.error ?? "Unable to select branch"); return; }
    setSelectedBranchId(branchId); setNotice("Active branch updated.");
  };

  const submitBranch = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/branches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(branchForm) });
      const data = await response.json() as { error?: string; branch?: Branch };
      if (!response.ok) throw new Error(data.error ?? "Unable to create branch");
      setPanel(null); setBranchForm({ name: "", address: "" }); setNotice("Branch created."); await refresh();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to create branch"); } finally { setBusy(false); }
  };

  const submitTransfer = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/inventory/transfers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: transferForm.productId, toBranchId: transferForm.toBranchId, quantity: Number(transferForm.quantity), reference: transferForm.reference || undefined }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to transfer stock");
      setPanel(null); setTransferForm({ productId: "", toBranchId: "", quantity: "", reference: "" }); setNotice("Stock transfer completed."); await refresh();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to transfer stock"); } finally { setBusy(false); }
  };

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
  const destinationBranches = branches.filter((branch) => branch.id !== selectedBranchId);

  return <main className="branches-shell">
    <header className="branches-topbar"><div className="branches-brand-row"><Link href="/" className="brand"><div className="brand-mark"><span></span><span></span><span></span></div><span>market<span className="brand-accent">flow</span></span></Link><span className="branches-divider"></span><span className="branches-title">Branches</span></div><div className="branches-top-actions"><ThemeToggle/><Link href="/" className="branches-back">Back to overview</Link></div></header>
    <div className="branches-content"><div className="branches-heading"><div><p className="eyebrow">MULTI-LOCATION CONTROL</p><h1>Branches</h1><p className="muted">Switch workspaces and move stock between locations without losing the audit trail.</p></div><div className="branches-actions"><button className="secondary-button" onClick={() => setPanel("transfer")}>↔ Transfer stock</button><button className="primary-button" onClick={() => setPanel("branch")}>＋ Add branch</button></div></div>
      {preview && <div className="branches-preview-note">Preview branches — sign in to switch live branches and transfer stock. <Link href="/login">Sign in</Link></div>}
      {notice && <p className="branches-notice success">{notice}</p>}{error && <p className="branches-notice error">{error}</p>}
      <section className="branches-layout"><div className="branches-list panel"><div className="branches-panel-heading"><div><h2>Your locations</h2><p className="muted">Select the branch used by POS, inventory, and reports.</p></div><span className="branches-count">{branches.length} active</span></div><div className="branch-cards">{branches.map((branch) => <button className={`branch-card ${branch.id === selectedBranchId ? "selected" : ""}`} key={branch.id} onClick={() => void selectBranch(branch.id)}><span className="branch-icon">⌂</span><span className="branch-copy"><strong>{branch.name}</strong><small>{branch.address ?? "Address not added"}</small></span><span className="branch-card-meta"><b>{branch.summary.units}</b><small>units</small></span><span className="branch-card-meta"><b>{branch.summary.products}</b><small>products</small></span><span className="branch-check">{branch.id === selectedBranchId ? "✓" : "›"}</span></button>)}</div></div><aside className="branch-summary panel"><p className="eyebrow">ACTIVE BRANCH</p><h2>{selectedBranch?.name ?? "No branch selected"}</h2><p className="muted">{selectedBranch?.address ?? "Add an address to make this location easier to identify."}</p><div className="branch-summary-grid"><div><span>Products</span><strong>{selectedBranch?.summary.products ?? 0}</strong></div><div><span>Units on hand</span><strong>{selectedBranch?.summary.units ?? 0}</strong></div></div><div className="branch-summary-note"><span>✓</span><p><strong>Stock stays separated</strong>Sales and inventory movements use the selected branch automatically.</p></div><Link className="secondary-button branch-inventory-link" href="/inventory">Open inventory →</Link></aside></section>
    </div>
    {panel && <div className="branches-overlay"><section className="branches-drawer" role="dialog" aria-modal="true"><div className="branches-drawer-head"><div><p className="eyebrow">{panel === "branch" ? "NEW LOCATION" : "INVENTORY MOVEMENT"}</p><h2>{panel === "branch" ? "Add branch" : "Transfer stock"}</h2></div><button className="branches-close" onClick={() => setPanel(null)} aria-label="Close">×</button></div>{panel === "branch" ? <form className="branches-form" onSubmit={submitBranch}><label>Branch name<input required value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} placeholder="e.g. Lekki Express"/></label><label>Address (optional)<input value={branchForm.address} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} placeholder="e.g. Admiralty Way, Lagos"/></label><button className="primary-button branches-submit" disabled={busy}>{busy ? "Saving…" : "Create branch"}</button></form> : <form className="branches-form" onSubmit={submitTransfer}><div className="transfer-route"><span>{selectedBranch?.name ?? "Source"}</span><b>→</b><select required value={transferForm.toBranchId} onChange={(event) => setTransferForm({ ...transferForm, toBranchId: event.target.value })}><option value="">Destination branch</option>{destinationBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div><label>Product<select required value={transferForm.productId} onChange={(event) => setTransferForm({ ...transferForm, productId: event.target.value })}><option value="">Select a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.balances[0]?.quantity ?? 0} units</option>)}</select></label><label>Quantity<input required min="1" type="number" value={transferForm.quantity} onChange={(event) => setTransferForm({ ...transferForm, quantity: event.target.value })} placeholder="0"/></label><label>Reference (optional)<input value={transferForm.reference} onChange={(event) => setTransferForm({ ...transferForm, reference: event.target.value })} placeholder="e.g. Replenishment run"/></label><button className="primary-button branches-submit" disabled={busy}>{busy ? "Transferring…" : "Transfer stock"}</button></form>}</section></div>}
  </main>;
}
