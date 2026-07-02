"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

type ShareType = "availability" | "referrals" | "scam" | "bad_guest" | "vendors" | "transport";
type Status = "pending" | "accepted" | "declined" | "revoked";
type Peer = {
  connectionId: string;
  status: Status;
  direction: "outgoing" | "incoming";
  peerPropertyId: string;
  peerName: string;
  peerLocality: string | null;
};

const SHARE_TYPES: ShareType[] = ["availability", "referrals", "scam", "bad_guest", "vendors", "transport"];
const SHARE_LABELS: Record<ShareType, string> = {
  availability: "Available rooms",
  referrals: "Overflow referrals",
  scam: "Scam / flagged numbers",
  bad_guest: "Bad-guest alerts",
  vendors: "Trusted vendors",
  transport: "Drivers & transport",
};

export function NetworkSection({
  connectCode,
  peers,
  grantsByPeer,
}: {
  connectCode: string | null;
  peers: Peer[];
  grantsByPeer: Record<string, string[]>;
}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const incoming = peers.filter((p) => p.status === "pending" && p.direction === "incoming");
  const outgoing = peers.filter((p) => p.status === "pending" && p.direction === "outgoing");
  const accepted = peers.filter((p) => p.status === "accepted");

  async function invite() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/community/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectCode: code.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not send the invite.");
      return;
    }
    setCode("");
    router.refresh();
  }

  async function respond(connectionId: string, action: "accept" | "decline" | "revoke") {
    if (action === "revoke" && !(await confirm({ title: "Disconnect", message: "Remove this connection? Sharing with them stops immediately.", danger: true, confirmLabel: "Disconnect" }))) return;
    await fetch(`/api/community/connections/${connectionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  async function toggleShare(peerPropertyId: string, dataType: ShareType, enabled: boolean) {
    await fetch("/api/community/sharing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ peerPropertyId, dataType, enabled }),
    });
    router.refresh();
  }

  return (
    <div>
      {/* Your connect code — share it so a peer can invite you. */}
      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="h3" style={{ marginBottom: 6 }}>Your connect code</div>
        <div className="muted" style={{ fontSize: "var(--fs-meta)", marginBottom: 8 }}>
          Share this with a nearby property so they can connect with you.
        </div>
        <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ fontFamily: "var(--font-mono, monospace)", background: "var(--surface-2, #f4f4f5)", padding: "6px 10px", borderRadius: 8, wordBreak: "break-all" }}>
            {connectCode ?? "—"}
          </code>
          {connectCode && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { navigator.clipboard?.writeText(connectCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          )}
        </div>
      </div>

      {/* Invite a peer by their connect code. */}
      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="h3" style={{ marginBottom: 10 }}>Connect with a property</div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 1, minWidth: 200 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste their connect code" />
          <button className="btn btn--primary btn--sm" onClick={invite} disabled={busy || !code.trim()}>
            {busy ? "Sending…" : "Send invite"}
          </button>
        </div>
        {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 8 }}>{error}</p>}
      </div>

      {/* Incoming invites to answer. */}
      {incoming.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="setgroup__label">Invitations</div>
          <div className="col" style={{ gap: 8 }}>
            {incoming.map((p) => (
              <div key={p.connectionId} className="card card--pad" style={{ padding: 14 }}>
                <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.peerName}</div>
                    {p.peerLocality && <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>{p.peerLocality}</div>}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn--primary btn--sm" onClick={() => respond(p.connectionId, "accept")}>Accept</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => respond(p.connectionId, "decline")}>Decline</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted peers with per-type sharing toggles. */}
      <div className="setgroup__label">Connected properties</div>
      {accepted.length === 0 && outgoing.length === 0 ? (
        <div className="empty">No connections yet. Share your code or invite a property above.</div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {accepted.map((p) => {
            const shared = new Set(grantsByPeer[p.peerPropertyId] ?? []);
            return (
              <div key={p.connectionId} className="card card--pad" style={{ padding: 14 }}>
                <div className="spread" style={{ gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.peerName}</div>
                    {p.peerLocality && <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>{p.peerLocality}</div>}
                  </div>
                  <button className="btn btn--danger btn--sm" onClick={() => respond(p.connectionId, "revoke")}>Disconnect</button>
                </div>
                <div className="muted" style={{ fontSize: "var(--fs-meta)", marginBottom: 8 }}>Share with this property:</div>
                <div className="col" style={{ gap: 6 }}>
                  {SHARE_TYPES.map((t) => (
                    <label key={t} className="row" style={{ gap: 8, cursor: "pointer", fontSize: "var(--fs-small)" }}>
                      <input type="checkbox" checked={shared.has(t)} onChange={(e) => toggleShare(p.peerPropertyId, t, e.target.checked)} />
                      <span>{SHARE_LABELS[t]}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {outgoing.map((p) => (
            <div key={p.connectionId} className="card card--pad" style={{ padding: 14 }}>
              <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.peerName}</div>
                  <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>Invite sent — waiting for them to accept</div>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => respond(p.connectionId, "revoke")}>Cancel</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
