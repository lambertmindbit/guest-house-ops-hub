"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useConfirm } from "@/components/ConfirmProvider";
import { SectionLabel } from "@/components/ui";

type Status = "referred" | "booked" | "declined";
type Partner = { id: string; name: string };
type Referral = {
  id: string; guestName: string; partnerName: string | null; guestPhone: string | null;
  checkIn: string | null; checkOut: string | null; status: Status; note: string | null;
};
type Summary = { total: number; referred: number; booked: number; declined: number; conversionRate: number };

const STATUS_CLS: Record<Status, string> = { referred: "badge--warn", booked: "badge--good", declined: "badge--neutral" };
const STATUS_LABEL: Record<Status, string> = { referred: "Referred", booked: "Booked", declined: "Declined" };

export function ReferralLogBoard({ referrals, partners, summary }: { referrals: Referral[]; partners: Partner[]; summary: Summary }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [nr, setNr] = useState({ guestName: "", partnerId: "", guestPhone: "", checkIn: "", checkOut: "", note: "" });
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body: unknown, method = "POST") {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
  }

  return (
    <div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)" }}>{error}</p>}

      <div className="kpi-strip" style={{ marginBottom: 14 }}>
        <div className="kpi-panel kpi-panel--verdict"><div className="kpi-eyebrow">Booked</div><div className="kpi-num">{summary.booked}</div><div className="kpi-ctx">{Math.round(summary.conversionRate * 100)}% of decided</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Referred</div><div className="kpi-num">{summary.referred}</div><div className="kpi-ctx">awaiting outcome</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Declined</div><div className="kpi-num">{summary.declined}</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Total</div><div className="kpi-num">{summary.total}</div></div>
      </div>

      {/* Add a referral */}
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <input className="input" placeholder="Guest name" value={nr.guestName} onChange={(e) => setNr({ ...nr, guestName: e.target.value })} />
          <select className="select" value={nr.partnerId} onChange={(e) => setNr({ ...nr, partnerId: e.target.value })}>
            <option value="">Referred to…</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" placeholder="Guest phone" value={nr.guestPhone} onChange={(e) => setNr({ ...nr, guestPhone: e.target.value })} />
          <input className="input" type="date" aria-label="Check-in" value={nr.checkIn} onChange={(e) => setNr({ ...nr, checkIn: e.target.value })} />
          <input className="input" type="date" aria-label="Check-out" value={nr.checkOut} onChange={(e) => setNr({ ...nr, checkOut: e.target.value })} />
          <input className="input" placeholder="Note" value={nr.note} onChange={(e) => setNr({ ...nr, note: e.target.value })} />
        </div>
        {partners.length === 0 && (
          <p className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 8 }}>Tip: add places in <Link href="/partners">Partners</Link> to pick who you referred to.</p>
        )}
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} disabled={!nr.guestName.trim() || (!!nr.checkOut && nr.checkOut <= nr.checkIn)}
          onClick={async () => {
            if (await call("/api/referrals", {
              guestName: nr.guestName.trim(),
              partnerId: nr.partnerId || null,
              guestPhone: nr.guestPhone.trim() || null,
              checkIn: nr.checkIn || null,
              checkOut: nr.checkOut || null,
              note: nr.note.trim() || null,
            })) setNr({ guestName: "", partnerId: "", guestPhone: "", checkIn: "", checkOut: "", note: "" });
          }}>
          Log referral
        </button>
      </div>

      <SectionLabel count={referrals.length}>Referrals</SectionLabel>
      <div className="col" style={{ gap: 8 }}>
        {referrals.length === 0 ? <div className="empty">No referrals logged yet.</div> : referrals.map((r) => (
          <div key={r.id} className="rowcard">
            <div className="rowcard__main">
              <div className="rowcard__name">{r.guestName}{r.partnerName ? <span className="muted" style={{ fontWeight: 400 }}> → {r.partnerName}</span> : null}</div>
              <div className="rowcard__meta">{[r.checkIn && r.checkOut ? `${r.checkIn} → ${r.checkOut}` : null, r.guestPhone, r.note].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <div className="row" style={{ gap: 6, alignItems: "center" }}>
              <span className={`badge ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              <select className="select" style={{ width: 120 }} value={r.status} onChange={(e) => call(`/api/referrals/${r.id}`, { status: e.target.value }, "PATCH")} aria-label="Referral status">
                {(["referred", "booked", "declined"] as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <button className="btn btn--quiet btn--icon btn--sm" onClick={async () => { if (await confirm({ title: "Delete referral", message: "Remove this referral from the log?", danger: true, confirmLabel: "Delete" })) call(`/api/referrals/${r.id}`, {}, "DELETE"); }} aria-label="Delete referral">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
