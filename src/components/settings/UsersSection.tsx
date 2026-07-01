"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

type Role = "owner" | "reception" | "housekeeping";
export type UserRow = { id: string; email: string; role: Role; active: boolean };

const ROLES: Role[] = ["owner", "reception", "housekeeping"];
const ROLE_HINT: Record<Role, string> = {
  owner: "Everything, including money & setup",
  reception: "Bookings & guests — no finance/analytics/pricing",
  housekeeping: "Today + cleaning only",
};

export function UsersSection({ users, currentUserId }: { users: UserRow[]; currentUserId: string | null }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("reception");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not add the user.");
      return;
    }
    setEmail("");
    setPassword("");
    setRole("reception");
    router.refresh();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    router.refresh();
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Remove user", message: "Delete this login? They will no longer be able to sign in.", danger: true, confirmLabel: "Delete" }))) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="h3" style={{ marginBottom: 10 }}>Add a login</div>
        <div className="form-grid" style={{ gap: 12 }}>
          <div>
            <label className="field-label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="reception@lawei.in" />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Role</label>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="field-hint">{ROLE_HINT[role]}</div>
          </div>
        </div>
        {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 8 }}>{error}</p>}
        <button className="btn btn--primary btn--sm" style={{ marginTop: 12 }} onClick={add} disabled={busy || !email || password.length < 8}>
          {busy ? "Adding…" : "Add user"}
        </button>
      </div>

      <div className="col" style={{ gap: 8 }}>
        {users.map((u) => (
          <div key={u.id} className="card card--pad" style={{ padding: 14 }}>
            <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{u.email}{u.id === currentUserId ? " (you)" : ""}</div>
                <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>{ROLE_HINT[u.role]}</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <select className="select" style={{ width: 140 }} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button className={`btn btn--sm ${u.active ? "btn--ghost" : "btn--primary"}`} onClick={() => patch(u.id, { active: !u.active })}>
                  {u.active ? "Disable" : "Enable"}
                </button>
                {u.id !== currentUserId && (
                  <button className="btn btn--danger btn--sm" onClick={() => remove(u.id)}>Delete</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
