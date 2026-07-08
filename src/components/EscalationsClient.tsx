"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { EscalationView, EscalationStats } from "@/lib/escalations";
import { displayINR } from "@/lib/format";

// A booking-request escalation's structured payload (see the Escalation.metadata
// schema comment). Parsed loosely here — the server is the source of truth on
// whether it's complete enough to approve; this just decides which UI to show.
type BookingMeta = {
  roomLabel?: string;
  roomTypeName?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  total?: number;
  guestName?: string;
  guestPhone?: string;
};

function bookingMeta(e: EscalationView): BookingMeta | null {
  if (e.category !== "booking") return null;
  const m = e.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const rec = m as Record<string, unknown>;
  if (rec.kind !== "booking_request") return null;
  return rec as BookingMeta;
}

// Escalations queue (matches the DPR Escalations screen — KPI strip + tabbed
// ticket table + per-ticket triage). Uses only documented design-system classes
// (.card .kpi .tbl .pill .btn .segmented .select .textarea .empty) and status
// tokens, so it slots into globals.css without new dependencies.

type Tab = "all" | "customer" | "driver";

const SEVERITY_TONE: Record<string, { bg: string; fg: string }> = {
  low: { bg: "var(--sys-fill)", fg: "var(--sys-label-2)" },
  medium: { bg: "var(--warn-fill)", fg: "var(--warn-text)" },
  high: { bg: "var(--clay-fill, var(--warn-fill))", fg: "var(--clay-text, var(--warn-text))" },
  critical: { bg: "var(--danger-fill)", fg: "var(--danger-text)" },
};
const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  open: { bg: "var(--warn-fill)", fg: "var(--warn-text)" },
  in_progress: { bg: "var(--tint-fill)", fg: "var(--tint-text)" },
  resolved: { bg: "var(--good-fill)", fg: "var(--good-text)" },
  dismissed: { bg: "var(--sys-fill)", fg: "var(--sys-label-3)" },
};
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  dismissed: "Dismissed",
};
const SOURCE_LABEL: Record<string, string> = {
  assistant: "Assistant",
  cab: "Cab",
  console: "Console",
  manual: "Manual",
};

function Pill({ tone, children }: { tone: { bg: string; fg: string }; children: React.ReactNode }) {
  return (
    <span className="badge" style={{ background: tone.bg, color: tone.fg }}>
      {children}
    </span>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function EscalationsClient({
  initialStats,
  initialItems,
}: {
  initialStats: EscalationStats;
  initialItems: EscalationView[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<EscalationView[]>(initialItems);
  const [tab, setTab] = useState<Tab>("all");
  const [showResolved, setShowResolved] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const stats = initialStats;

  const refetch = useCallback(async () => {
    const res = await fetch("/api/escalations");
    const json = await res.json();
    if (json.data) setItems(json.data as EscalationView[]);
    router.refresh(); // recompute the server-rendered KPI strip
  }, [router]);

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusy(id);
      try {
        const res = await fetch(`/api/escalations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) await refetch();
      } finally {
        setBusy(null);
      }
    },
    [refetch],
  );

  // Distinct from patch: POSTs to /approve (creates the reservation), and
  // returns an error string on failure so the booking card can show it inline
  // (a 409 room-conflict must NOT look like a silent no-op).
  const approveBooking = useCallback(
    async (id: string): Promise<string | null> => {
      setBusy(id);
      try {
        const res = await fetch(`/api/escalations/${id}/approve`, { method: "POST" });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          await refetch();
          return null;
        }
        return json.error || "Couldn't approve this request.";
      } finally {
        setBusy(null);
      }
    },
    [refetch],
  );

  const visible = items.filter((e) => {
    if (!showResolved && (e.status === "resolved" || e.status === "dismissed")) return false;
    if (tab === "customer") return e.category === "customer" || e.category === "booking" || e.category === "payment";
    if (tab === "driver") return e.category === "driver";
    return true;
  });

  return (
    <main className="app-main">
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h2)" }}>Escalations</h1>
        <p style={{ margin: "4px 0 0", color: "var(--sys-label-2)", fontSize: "var(--fs-body)" }}>
          Requests the AI agents handed to a human, plus anything you raise by hand.
        </p>
      </header>

      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div className="kpi">
          <span className="kpi-label">Open</span>
          <span className="kpi-value">{stats.openTotal}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">In progress</span>
          <span className="kpi-value">{stats.inProgress}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Avg response</span>
          <span className="kpi-value">
            {stats.avgFirstResponseMins == null ? "—" : fmtMins(stats.avgFirstResponseMins)}
          </span>
        </div>
        <div className="kpi" style={stats.critical > 0 ? { borderColor: "var(--danger)" } : undefined}>
          <span className="kpi-label">Critical</span>
          <span className="kpi-value" style={stats.critical > 0 ? { color: "var(--danger)" } : undefined}>
            {stats.critical}
          </span>
        </div>
      </div>

      {/* Tabs + show-resolved toggle */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div className="segmented" role="tablist">
          {(["all", "customer", "driver"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "is-active" : ""}
              onClick={() => setTab(t)}
            >
              {t === "all" ? "All" : t === "customer" ? "Customer" : "Driver"}
            </button>
          ))}
        </div>
        <label style={{ marginLeft: "auto", display: "flex", gap: 7, alignItems: "center", fontSize: "var(--fs-body)" }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show resolved
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="empty">Nothing in the queue. When an agent escalates something, it lands here.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {visible.map((e) => {
            const open = expanded === e.id;
            return (
              <div key={e.id} style={{ borderBottom: "1px solid var(--line)" }}>
                {/* row */}
                <button
                  onClick={() => setExpanded(open ? null : e.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    padding: "12px 14px",
                    cursor: "pointer",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                      <Pill tone={SEVERITY_TONE[e.severity]}>{e.severity}</Pill>
                      <Pill tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Pill>
                      <span style={{ fontSize: "var(--fs-meta)", color: "var(--sys-label-3)", fontWeight: 600 }}>
                        {SOURCE_LABEL[e.source]}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-body)", marginTop: 4 }}>{e.title}</div>
                    <div style={{ fontSize: "var(--fs-small)", color: "var(--sys-label-2)", marginTop: 2 }}>
                      {e.raisedByName || "Unknown"}
                      {e.raisedByContact ? ` · ${e.raisedByContact}` : ""}
                      {e.raisedByLang && e.raisedByLang !== "en" ? ` · ${e.raisedByLang.toUpperCase()}` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: "var(--fs-meta)", color: "var(--sys-label-3)", whiteSpace: "nowrap" }}>
                    {timeAgo(e.createdAt)}
                  </div>
                </button>

                {/* detail + actions */}
                {open && (
                  <div style={{ padding: "0 14px 14px", display: "grid", gap: 10 }}>
                    {bookingMeta(e) ? (
                      <BookingRequestCard
                        e={e}
                        meta={bookingMeta(e)!}
                        busy={busy === e.id}
                        onApprove={() => approveBooking(e.id)}
                        onDecline={(note) => patch(e.id, { status: "dismissed", resolutionNote: note || "Declined" })}
                      />
                    ) : (
                      <>
                        <div style={{ fontSize: "var(--fs-body)", lineHeight: 1.5 }}>{e.summary}</div>

                        {e.reason && (
                          <div
                            className="banner"
                            style={{ fontSize: "var(--fs-small)", background: "var(--warn-fill)", color: "var(--warn-text)" }}
                          >
                            <strong>Why escalated:</strong> {e.reason}
                          </div>
                        )}

                        {(e.originalText || e.translatedText) && (
                          <div
                            style={{
                              fontSize: "var(--fs-small)",
                              border: "1px solid var(--line)",
                              borderRadius: "var(--r-md, 10px)",
                              padding: "10px 12px",
                              background: "var(--sys-fill)",
                            }}
                          >
                            {e.originalText && (
                              <div>
                                <span style={{ color: "var(--sys-label-3)", fontWeight: 600 }}>
                                  Original{e.raisedByLang ? ` (${e.raisedByLang.toUpperCase()})` : ""}:
                                </span>{" "}
                                {e.originalText}
                              </div>
                            )}
                            {e.translatedText && (
                              <div style={{ marginTop: e.originalText ? 6 : 0 }}>
                                <span style={{ color: "var(--sys-label-3)", fontWeight: 600 }}>Translation:</span>{" "}
                                {e.translatedText}
                              </div>
                            )}
                          </div>
                        )}

                        {e.relatedType !== "none" && e.relatedId && (
                          <a
                            href={relatedHref(e.relatedType, e.relatedId)}
                            className="btn btn--outline btn--sm"
                            style={{ justifySelf: "start" }}
                          >
                            Open {e.relatedType}
                          </a>
                        )}

                        <TriageActions
                          e={e}
                          busy={busy === e.id}
                          onPatch={(body) => patch(e.id, body)}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

// A booking request from the public widget: structured detail + a direct
// decision (Approve & book creates the reservation right here; Decline sends
// it to dismissed) — no severity dropdown or generic Claim/Resolve, which
// don't mean anything for "should I take this booking or not."
function BookingRequestCard({
  e,
  meta,
  busy,
  onApprove,
  onDecline,
}: {
  e: EscalationView;
  meta: BookingMeta;
  busy: boolean;
  onApprove: () => Promise<string | null>;
  onDecline: (note: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const terminal = e.status === "resolved" || e.status === "dismissed";

  async function handleApprove() {
    setError(null);
    const err = await onApprove();
    if (err) setError(err);
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md, 10px)",
          padding: "10px 12px",
          display: "grid",
          gap: 4,
          fontSize: "var(--fs-small)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "var(--fs-body)" }}>
          {meta.roomLabel} <span style={{ fontWeight: 400, color: "var(--sys-label-2)" }}>· {meta.roomTypeName}</span>
        </div>
        <div>{meta.checkIn} → {meta.checkOut}{meta.nights ? ` · ${meta.nights} night${meta.nights === 1 ? "" : "s"}` : ""}</div>
        <div>{meta.guestName} · {meta.guestPhone}</div>
        {typeof meta.total === "number" && (
          <div style={{ fontWeight: 600 }}>{displayINR(meta.total)}</div>
        )}
      </div>

      {terminal ? (
        <div style={{ fontSize: "var(--fs-small)" }}>
          {e.status === "resolved" ? (
            <div style={{ color: "var(--good-text)", fontWeight: 600 }}>
              ✓ Booked
              {e.relatedType === "reservation" && e.relatedId && (
                <>
                  {" — "}
                  <Link href={`/reservations/${e.relatedId}`} className="btn btn--outline btn--sm" style={{ marginLeft: 6 }}>
                    Open reservation
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div style={{ color: "var(--sys-label-2)" }}>
              Declined{e.resolutionNote ? ` — ${e.resolutionNote}` : ""}
            </div>
          )}
        </div>
      ) : (
        <>
          {error && (
            <div className="banner" style={{ fontSize: "var(--fs-small)", background: "var(--danger-fill)", color: "var(--danger-text)" }}>
              {error}
            </div>
          )}
          {declining ? (
            <div style={{ display: "grid", gap: 7 }}>
              <textarea
                className="textarea"
                placeholder="Reason (optional) — the request is just marked declined; nothing is sent to the guest automatically."
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
                rows={2}
              />
              <div style={{ display: "flex", gap: 7 }}>
                <button className="btn btn--danger btn--sm" disabled={busy} onClick={() => onDecline(note)}>Confirm decline</button>
                <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setDeclining(false)}>Back</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 7 }}>
              <button className="btn btn--good btn--sm" disabled={busy} onClick={handleApprove}>
                {busy ? "Booking…" : "Approve & book"}
              </button>
              <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setDeclining(true)}>Decline</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TriageActions({
  e,
  busy,
  onPatch,
}: {
  e: EscalationView;
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  const [note, setNote] = useState("");
  const terminal = e.status === "resolved" || e.status === "dismissed";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: "var(--fs-small)", color: "var(--sys-label-3)" }}>Severity</label>
        <select
          className="select"
          value={e.severity}
          disabled={busy}
          onChange={(ev) => onPatch({ severity: ev.target.value })}
          style={{ width: "auto", padding: "5px 8px", fontSize: "var(--fs-small)" }}
        >
          {["low", "medium", "high", "critical"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {e.status === "open" && (
          <button className="btn btn--sm" disabled={busy} onClick={() => onPatch({ status: "in_progress" })}>
            Claim
          </button>
        )}
        {!terminal && (
          <button
            className="btn btn--ghost btn--sm"
            disabled={busy}
            onClick={() => onPatch({ status: "dismissed" })}
          >
            Dismiss
          </button>
        )}
        {terminal && (
          <button className="btn btn--outline btn--sm" disabled={busy} onClick={() => onPatch({ status: "open" })}>
            Reopen
          </button>
        )}
      </div>

      {!terminal && (
        <div style={{ display: "flex", gap: 7, alignItems: "flex-end", flexWrap: "wrap" }}>
          <textarea
            className="textarea"
            placeholder="Resolution note (optional)"
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            rows={2}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button
            className="btn btn--good btn--sm"
            disabled={busy}
            onClick={() => onPatch({ status: "resolved", resolutionNote: note || null })}
          >
            Resolve
          </button>
        </div>
      )}

      {terminal && e.resolutionNote && (
        <div style={{ fontSize: "var(--fs-small)", color: "var(--sys-label-2)" }}>
          <strong>Resolution:</strong> {e.resolutionNote}
        </div>
      )}
    </div>
  );
}

function relatedHref(type: string, id: string): string {
  if (type === "reservation") return `/reservations/${id}`;
  if (type === "guest") return `/guests/${id}`;
  return "#";
}

function fmtMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
