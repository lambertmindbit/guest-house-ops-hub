"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionLabel } from "@/components/ui";

type Status = "pending" | "sent" | "received" | "responded";
type Review = { id: string; channel: string; status: Status; rating: number | null; responseDraft: string | null; link: string | null };
type Summary = { total: number; received: number; responded: number; avgRating: number | null; responseRate: number };

const STATUS_LABEL: Record<Status, string> = { pending: "Pending", sent: "Sent", received: "Received", responded: "Responded" };
const STATUS_CLS: Record<Status, string> = { pending: "badge--neutral", sent: "badge--sent", received: "badge--warn", responded: "badge--good" };

export function ReviewsBoard({ reviews, summary }: { reviews: Review[]; summary: Summary }) {
  const router = useRouter();
  const [channel, setChannel] = useState("Google");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function call(url: string, body: unknown, method = "POST") {
    await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    router.refresh();
  }

  return (
    <div>
      <div className="kpi-strip" style={{ marginBottom: 14 }}>
        <div className="kpi-panel kpi-panel--verdict"><div className="kpi-eyebrow">Avg rating</div><div className="kpi-num">{summary.avgRating ?? "—"}</div><div className="kpi-ctx">of 5</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Requests</div><div className="kpi-num">{summary.total}</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Received</div><div className="kpi-num">{summary.received}</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Response rate</div><div className="kpi-num">{summary.responseRate}%</div></div>
      </div>

      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" placeholder="Channel (Google, MakeMyTrip…)" value={channel} onChange={(e) => setChannel(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn--primary btn--sm" onClick={() => call("/api/reviews", { channel })}>Track a review request</button>
        </div>
        <div className="field-hint">The ROOT assistant sends the actual request — this tracks status and drafts your reply.</div>
      </div>

      <SectionLabel count={reviews.length}>Reviews</SectionLabel>
      <div className="col" style={{ gap: 10 }}>
        {reviews.length === 0 ? <div className="empty">No review requests tracked yet.</div> : reviews.map((r) => (
          <div key={r.id} className="card card--pad">
            <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{r.channel}</span>
                {r.rating != null && <span className="badge badge--paid">{r.rating}★</span>}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <span className={`badge ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                <select className="select" style={{ width: 120 }} value={r.status} onChange={(e) => call(`/api/reviews/${r.id}`, { status: e.target.value }, "PATCH")}>
                  {(["pending", "sent", "received", "responded"] as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={`btn btn--sm ${r.rating === n ? "btn--primary" : "btn--ghost"}`} onClick={() => call(`/api/reviews/${r.id}`, { rating: r.rating === n ? null : n }, "PATCH")}>{n}★</button>
              ))}
            </div>
            <textarea className="textarea" style={{ marginTop: 10, minHeight: 60 }} placeholder="Draft a response…"
              value={drafts[r.id] ?? r.responseDraft ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))} />
            <button className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={() => call(`/api/reviews/${r.id}`, { responseDraft: (drafts[r.id] ?? r.responseDraft ?? "").trim() || null }, "PATCH")}>Save draft</button>
          </div>
        ))}
      </div>
    </div>
  );
}
