"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "../components/theme-toggle";

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", businessName: "", businessCategory: "Retail", branchName: "Main Store" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Unable to create the account");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return <main className="auth-shell"><div className="auth-top"><Link href="/" className="brand"><div className="brand-mark"><span></span><span></span><span></span></div><span>market<span className="brand-accent">flow</span></span></Link><ThemeToggle /></div><section className="auth-card auth-card-wide"><div className="auth-kicker">Start your workspace</div><h1>Set up your business</h1><p className="auth-copy">Create your workspace and start organizing retail operations in minutes.</p><form className="auth-form auth-form-grid" onSubmit={submit}><label>Your name<input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Amaka Okafor" autoComplete="name" required /></label><label>Email address<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="you@business.com" autoComplete="email" required /></label><label>Business name<input value={form.businessName} onChange={(event) => update("businessName", event.target.value)} placeholder="Sunrise Mart" required /></label><label>Business category<select value={form.businessCategory} onChange={(event) => update("businessCategory", event.target.value)}><option>Retail</option><option>Supermarket</option><option>Pharmacy</option><option>Wholesale</option><option>Other</option></select></label><label>First branch<input value={form.branchName} onChange={(event) => update("branchName", event.target.value)} placeholder="Main Store" required /></label><label>Password<input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required /></label>{error && <p className="auth-error auth-grid-full">{error}</p>}<button className="primary-button auth-submit auth-grid-full" disabled={busy}>{busy ? "Creating workspace…" : "Create workspace"}</button></form><p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p></section><p className="auth-footer">Secure workspace access · MarketFlow</p></main>;
}
