"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "../components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Unable to sign in");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return <AuthFrame><div className="auth-kicker">Welcome back</div><h1>Sign in to MarketFlow</h1><p className="auth-copy">Run your retail workspace with clarity and confidence.</p><form className="auth-form" onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required /></label>{error && <p className="auth-error">{error}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form><p className="auth-switch">New to MarketFlow? <Link href="/onboarding">Create a business account</Link></p></AuthFrame>;
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return <main className="auth-shell"><div className="auth-top"><Link href="/" className="brand"><div className="brand-mark"><span></span><span></span><span></span></div><span>market<span className="brand-accent">flow</span></span></Link><ThemeToggle /></div><section className="auth-card">{children}</section><p className="auth-footer">Secure workspace access · MarketFlow</p></main>;
}
