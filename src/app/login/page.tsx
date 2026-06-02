"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Login failed.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card shimmer" style={{ width: "100%", maxWidth: 380, padding: 28 }}>
        <div className="row" style={{ gap: 10, marginBottom: 4 }}>
          <span className="brand__mark"><Icon name="door" size={18} /></span>
          <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em" }}>Ops Hub</span>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--subtle)", margin: "0 0 22px" }}>Sign in to continue.</p>

        <form onSubmit={onSubmit} className="col" style={{ gap: 14 }}>
          {error && (
            <div className="banner banner--danger" style={{ cursor: "default" }}>
              <span style={{ flex: 1 }}>{error}</span>
            </div>
          )}
          <div>
            <label className="field-label">Email</label>
            <input className="input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={busy} className="btn btn--primary btn--block" style={{ marginTop: 4 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
