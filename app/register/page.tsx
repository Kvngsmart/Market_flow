"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import ThemeToggle from "../components/theme-toggle";

type Register = { id: string; name: string; branchId: string };
type Shift = { id: string; status: "OPEN" | "CLOSED"; openingFloatMinor: number; expectedCashMinor: number; closingCashMinor?: number | null; openedAt: string; closedAt?: string | null };
const money = (minor: number) => `₦${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(Math.round(minor / 100))}`;

export default function RegisterPage() {
  const [register, setRegister] = useState<Register | null>({ id: "preview-register", name: "Register 01", branchId: "preview-branch" });
  const [shift, setShift] = useState<Shift | null>({ id: "preview-shift", status: "OPEN", openingFloatMinor: 5000000, expectedCashMinor: 9850000, openedAt: "2026-11-03T08:00:00.000Z" });
  const [preview, setPreview] = useState(true);
  const [openingFloat, setOpeningFloat] = useState("50000");
  const [closingCash, setClosingCash] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch("/api/register");
    if (!response.ok) return;
    const data = await response.json() as { register: Register | null; shift: Shift | null };
    setRegister(data.register); setShift(data.shift); setPreview(false);
  };
  useEffect(() => { load().catch(() => undefined); }, []);

  const openRegister = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ openingFloatMinor: Math.round(Number(openingFloat) * 100) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to open register");
      setNotice("Register opened successfully."); await load();
    } catch (openError) { setError(openError instanceof Error ? openError.message : "Unable to open register"); } finally { setBusy(false); }
  };

  const closeRegister = async (event: FormEvent) => {
    event.preventDefault(); if (!shift) return; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/register", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shiftId: shift.id, closingCashMinor: Math.round(Number(closingCash) * 100) }) });
      const data = await response.json() as { error?: string; varianceMinor?: number };
      if (!response.ok) throw new Error(data.error ?? "Unable to close register");
      setNotice(`Register closed. Variance: ${money(data.varianceMinor ?? 0)}.`); await load();
    } catch (closeError) { setError(closeError instanceof Error ? closeError.message : "Unable to close register"); } finally { setBusy(false); }
  };

  const variance = shift ? (shift.expectedCashMinor - shift.openingFloatMinor) : 0;
  return <main className="register-shell"><header className="register-topbar"><div className="register-brand-row"><Link href="/" className="brand"><div className="brand-mark"><span></span><span></span><span></span></div><span>market<span className="brand-accent">flow</span></span></Link><span className="register-divider"></span><span className="register-title">Cash register</span></div><div className="register-top-actions"><ThemeToggle/><Link href="/pos" className="primary-button">Open POS</Link><Link href="/" className="register-back">Back to overview</Link></div></header><div className="register-content"><div className="register-heading"><div><p className="eyebrow">REGISTER CONTROL</p><h1>Cash register</h1><p className="muted">Open a shift before trading and reconcile cash before closing.</p></div><span className={`register-status ${shift ? "open" : "closed"}`}><i></i>{shift ? "Shift open" : "Register closed"}</span></div>{preview && <div className="register-preview-note">Preview shift — sign in to open and reconcile your live register. <Link href="/login">Sign in</Link></div>}{notice && <p className="register-notice success">{notice}</p>}{error && <p className="register-notice error">{error}</p>}<div className="register-layout"><section className="register-card panel"><div className="register-card-head"><div><p className="eyebrow">{register?.name ?? "REGISTER 01"}</p><h2>{shift ? "Current shift" : "Ready for a new shift"}</h2></div><span className="register-branch-label">Main Store</span></div>{shift ? <><div className="register-metrics"><div><span>Opening float</span><strong>{money(shift.openingFloatMinor)}</strong></div><div><span>Cash sales</span><strong>{money(variance)}</strong></div><div><span>Expected cash</span><strong>{money(shift.expectedCashMinor)}</strong></div></div><div className="register-shift-time"><span>Opened</span><b>{new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(shift.openedAt))}</b></div><form className="register-form" onSubmit={closeRegister}><label>Counted cash at close (₦)<input required min="0" step="0.01" type="number" value={closingCash} onChange={(event) => setClosingCash(event.target.value)} placeholder={String(Math.round(shift.expectedCashMinor / 100))}/></label><button className="danger-button register-submit" disabled={busy}>{busy ? "Closing…" : "Close and reconcile shift"}</button></form></> : <form className="register-form register-open-form" onSubmit={openRegister}><div className="register-open-icon">▣</div><p>Start the day with the cash physically in the drawer. MarketFlow will compare it with verified cash sales when you close.</p><label>Opening float (₦)<input required min="0" step="0.01" type="number" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)}/></label><button className="primary-button register-submit" disabled={busy}>{busy ? "Opening…" : "Open register"}</button></form>}</section><aside className="register-side"><div className="register-info panel"><p className="eyebrow">SHIFT SAFETY</p><h3>Every naira accounted for</h3><p>Closing compares your counted drawer with the opening float plus successful cash payments. Card and transfer payments are never included in the cash expectation.</p><Link href="/sales">Review receipts →</Link></div><div className="register-links panel"><Link href="/pos"><span>▣</span><div><strong>Open point of sale</strong><small>Start a new transaction</small></div><b>›</b></Link><Link href="/sales"><span>▤</span><div><strong>Sales & receipts</strong><small>Review today&apos;s activity</small></div><b>›</b></Link></div></aside></div></div></main>;
}
