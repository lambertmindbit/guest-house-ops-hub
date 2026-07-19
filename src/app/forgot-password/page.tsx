"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Always show the same confirmation (no user enumeration), matching the API.
    await fetch("/api/auth/reset-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => {});
    setBusy(false);
    setSent(true);
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card entrance" style={{ width: "100%", maxWidth: 380, padding: 28 }}>
        <div className="row" style={{ gap: 10, marginBottom: 4 }}>
          <span className="brandmark"><Icon name="door" size={18} /></span>
          <span style={{ fontWeight: 700, fontSize: "var(--fs-h2)", letterSpacing: "-0.01em" }}>Ops Hub</span>
        </div>
        {sent ? (
          <>
            <p style={{ fontSize: "var(--fs-body)", color: "var(--text-subtle)", margin: "0 0 18px" }}>
              If an account exists for <b>{email}</b>, a password-reset link is on its way. It expires in 1 hour.
            </p>
            <Link href="/login" className="btn btn--ghost btn--block">Back to sign in</Link>
          </>
        ) : (
          <>
            <p style={{ fontSize: "var(--fs-body)", color: "var(--text-subtle)", margin: "0 0 22px" }}>Enter your email and we&apos;ll send a reset link.</p>
            <form onSubmit={onSubmit} className="col" style={{ gap: 14 }}>
              <div>
                <label className="field-label">Email</label>
                <input className="input" type="email" required autoComplete="username" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button type="submit" disabled={busy} className="btn btn--primary btn--block" style={{ marginTop: 4 }}>{busy ? "Sending…" : "Send reset link"}</button>
              <Link href="/login" style={{ textAlign: "center", fontSize: "var(--fs-small)", color: "var(--text-subtle)" }}>Back to sign in</Link>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
