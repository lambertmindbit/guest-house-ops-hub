"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

// Shared "set a password with a token" form — used by both accept-invite and
// password-reset (identical shape: token + new password → POST → redirect).
export function PasswordSetForm({
  token,
  endpoint,
  redirectTo,
  title,
  submitLabel,
}: {
  token: string;
  endpoint: string;
  redirectTo: string;
  title: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Something went wrong.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card entrance" style={{ width: "100%", maxWidth: 380, padding: 28 }}>
        <div className="row" style={{ gap: 10, marginBottom: 4 }}>
          <span className="brandmark"><Icon name="door" size={18} /></span>
          <span style={{ fontWeight: 700, fontSize: "var(--fs-h2)", letterSpacing: "-0.01em" }}>Ops Hub</span>
        </div>
        <p style={{ fontSize: "var(--fs-body)", color: "var(--text-subtle)", margin: "0 0 22px" }}>{title}</p>

        {!token ? (
          <div className="banner banner--danger" style={{ cursor: "default" }}><span style={{ flex: 1 }}>This link is missing its token. Ask for a new one.</span></div>
        ) : (
          <form onSubmit={onSubmit} className="col" style={{ gap: 14 }}>
            {error && <div className="banner banner--danger" style={{ cursor: "default" }}><span style={{ flex: 1 }}>{error}</span></div>}
            <div>
              <label className="field-label">New password</label>
              <input className="input" type="password" required autoComplete="new-password" aria-label="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Confirm password</label>
              <input className="input" type="password" required autoComplete="new-password" aria-label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button type="submit" disabled={busy} className="btn btn--primary btn--block" style={{ marginTop: 4 }}>
              {busy ? "Saving…" : submitLabel}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
