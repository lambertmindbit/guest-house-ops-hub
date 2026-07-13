"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { EscalationView, EscalationStats } from "@/lib/escalations";
import { displayINR, displayDMY } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmProvider";
import { Icon, PageHead, EmptyState } from "@/components/ui";

// Escalations queue: KPI strip → filterable ticket table → detail drawer.
// Everything shown is real data on the Escalation model; there is deliberately NO
// "reply to guest" composer, because the messaging outbox does not deliver yet —
// a Send button that silently reaches nobody is worse than none. The drawer
// instead offers tap-to-call / WhatsApp on the contact we DO have.

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

type Tab = "all" | "customer" | "driver";

const SEVERITY_CLASS: Record<string, string> = {
  low: "badge--neutral",
  medium: "badge--warn",
  high: "badge--danger",
  critical: "badge--danger",
};
const STATUS_CLASS: Record<string, string> = {
  open: "badge--warn",
  in_progress: "badge--sent",
  resolved: "badge--good",
  dismissed: "badge--neutral",
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

function ticketNo(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

function initials(name: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "?";
  return n.split(/\s+/).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function fmtMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Digits only — what tel:/wa.me need.
function dial(contact: string | null): string | null {
  const d = (contact ?? "").replace(/\D/g, "");
  return d.length >= 7 ? d : null;
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
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("active"); // active = open + in_progress
  const [severityF, setSeverityF] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  // Distinct from patch: POSTs to /approve (creates the reservation) and returns
  // an error string on failure so a 409 room-conflict never looks like a no-op.
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

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((e) => {
      if (statusF === "active" && (e.status === "resolved" || e.status === "dismissed")) return false;
      if (statusF !== "active" && statusF !== "all" && e.status !== statusF) return false;
      if (severityF !== "all" && e.severity !== severityF) return false;
      if (tab === "customer" && !["customer", "booking", "payment"].includes(e.category)) return false;
      if (tab === "driver" && e.category !== "driver") return false;
      if (needle) {
        const hay = `${e.title} ${e.raisedByName ?? ""} ${e.raisedByContact ?? ""} ${ticketNo(e.id)}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, q, statusF, severityF, tab]);

  // Keep the drawer's ticket in sync with refetched data; close it if it vanishes.
  const selected = selectedId ? items.find((e) => e.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!selected) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <main className="app-main">
      <PageHead
        title="Escalations"
        sub="Requests the AI agents handed to a human, plus anything you raise by hand."
        right={
          <button className="btn btn--ghost btn--sm" onClick={refetch}>
            Refresh
          </button>
        }
      />

      <div className="kpi-strip" style={{ marginTop: 14, marginBottom: 16 }}>
        <div className="kpi-panel">
          <div className="kpi-eyebrow">Open</div>
          <div className="kpi-num">{stats.openTotal}</div>
          <div className="kpi-ctx">waiting on you</div>
        </div>
        <div className="kpi-panel">
          <div className="kpi-eyebrow">In progress</div>
          <div className="kpi-num">{stats.inProgress}</div>
          <div className="kpi-ctx">claimed</div>
        </div>
        <div className="kpi-panel">
          <div className="kpi-eyebrow">Avg response</div>
          <div className="kpi-num">{stats.avgFirstResponseMins == null ? "—" : fmtMins(stats.avgFirstResponseMins)}</div>
          <div className="kpi-ctx">time to first reply</div>
        </div>
        <div className="kpi-panel">
          <div className="kpi-eyebrow">Critical</div>
          <div className="kpi-num" style={stats.critical > 0 ? { color: "var(--red-text)" } : undefined}>
            {stats.critical}
          </div>
          <div className="kpi-ctx">{stats.critical > 0 ? "needs attention" : "all clear"}</div>
        </div>
      </div>

      <div className="esc-toolbar">
        <div className="esc-tabs" role="tablist">
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
        <input
          className="input"
          style={{ flex: 1, minWidth: 160 }}
          placeholder="Search guest, title or ticket…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search escalations"
        />
        <select className="select" style={{ width: "auto" }} value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Status">
          <option value="active">Active</option>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select className="select" style={{ width: "auto" }} value={severityF} onChange={(e) => setSeverityF(e.target.value)} aria-label="Severity">
          <option value="all">All severities</option>
          {["critical", "high", "medium", "low"].map((s) => (
            <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState>
          {items.length === 0
            ? "Nothing in the queue. When an agent escalates something, it lands here."
            : "No tickets match those filters."}
        </EmptyState>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Guest</th>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr
                  key={e.id}
                  className={`esc-row${selectedId === e.id ? " is-sel" : ""}`}
                  onClick={() => setSelectedId(e.id)}
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      setSelectedId(e.id);
                    }
                  }}
                >
                  <td className="strong">{ticketNo(e.id)}</td>
                  <td>
                    <span className="esc-who">
                      <span className="avatar" aria-hidden="true">{initials(e.raisedByName)}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="strong">{e.raisedByName || "Unknown"}</span>
                        {e.raisedByContact && (
                          <span className="muted" style={{ display: "block", fontSize: "var(--fs-meta)" }}>
                            {e.raisedByContact}
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="esc-title">{e.title}</td>
                  <td><span className={`badge ${SEVERITY_CLASS[e.severity]}`}>{e.severity}</span></td>
                  <td><span className={`badge ${STATUS_CLASS[e.status]}`}>{STATUS_LABEL[e.status]}</span></td>
                  <td className="muted">{timeAgo(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <>
          <div className="esc-backdrop" onClick={() => setSelectedId(null)} />
          <aside className="esc-drawer" role="dialog" aria-modal="true" aria-label={selected.title}>
            <div className="esc-drawer__hd">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "var(--fs-h3)" }}>{selected.title}</div>
                <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 3 }}>
                  Ticket {ticketNo(selected.id)} · {SOURCE_LABEL[selected.source]} · {timeAgo(selected.createdAt)}
                </div>
              </div>
              <button className="btn btn--quiet btn--icon btn--sm" onClick={() => setSelectedId(null)} aria-label="Close">
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="esc-drawer__bd">
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className={`badge ${SEVERITY_CLASS[selected.severity]}`}>{selected.severity}</span>
                <span className={`badge ${STATUS_CLASS[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
              </div>

              <div className="esc-block">
                <div className="esc-block__lbl">Context summary</div>
                <div style={{ fontSize: "var(--fs-small)", lineHeight: 1.55 }}>{selected.summary}</div>
              </div>

              {selected.reason && (
                <div className="banner banner--warn" style={{ fontSize: "var(--fs-small)" }}>
                  <span className="banner__txt"><strong>Why escalated:</strong> {selected.reason}</span>
                </div>
              )}

              <GuestMessage e={selected} />
              <GuestContact e={selected} />

              {selected.relatedType !== "none" && selected.relatedId && (
                <Link href={relatedHref(selected.relatedType, selected.relatedId)} className="btn btn--outline btn--sm" style={{ justifySelf: "start" }}>
                  Open {selected.relatedType}
                </Link>
              )}

              {bookingMeta(selected) ? (
                <BookingRequestCard
                  e={selected}
                  meta={bookingMeta(selected)!}
                  busy={busy === selected.id}
                  onApprove={() => approveBooking(selected.id)}
                  onDecline={(note) => patch(selected.id, { status: "dismissed", resolutionNote: note || "Declined" })}
                />
              ) : (
                <TriageActions e={selected} busy={busy === selected.id} onPatch={(body) => patch(selected.id, body)} />
              )}
            </div>
          </aside>
        </>
      )}
    </main>
  );
}

// The guest's own words. When we have both the original (often Khasi/Hindi) and a
// translation, let the reader flip between them — the local-language moat.
function GuestMessage({ e }: { e: EscalationView }) {
  const both = !!e.originalText && !!e.translatedText;
  const [local, setLocal] = useState(false);
  if (!e.originalText && !e.translatedText) return null;

  const lang = e.raisedByLang ? e.raisedByLang.toUpperCase() : "Original";
  const text = both ? (local ? e.originalText : e.translatedText) : (e.translatedText ?? e.originalText);

  return (
    <div className="esc-block">
      <div className="spread" style={{ alignItems: "center", marginBottom: 5 }}>
        <div className="esc-block__lbl" style={{ marginBottom: 0 }}>What the guest said</div>
        {both && (
          <div className="esc-tabs" style={{ padding: 2 }}>
            <button className={!local ? "is-active" : ""} onClick={() => setLocal(false)}>EN</button>
            <button className={local ? "is-active" : ""} onClick={() => setLocal(true)}>{lang}</button>
          </div>
        )}
      </div>
      <div style={{ fontSize: "var(--fs-small)", lineHeight: 1.55 }}>{text}</div>
    </div>
  );
}

// No reply composer on purpose (the outbox doesn't deliver yet). What the owner
// actually does is phone the guest — so surface that, on the contact we have.
function GuestContact({ e }: { e: EscalationView }) {
  const d = dial(e.raisedByContact);
  if (!e.raisedByName && !e.raisedByContact) return null;

  return (
    <div className="esc-block">
      <div className="esc-block__lbl">Guest</div>
      <div style={{ fontSize: "var(--fs-small)", fontWeight: 600 }}>{e.raisedByName || "Unknown"}</div>
      {e.raisedByContact && (
        <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>{e.raisedByContact}</div>
      )}
      {d && (
        <div className="row" style={{ gap: 6, marginTop: 9 }}>
          <a className="btn btn--outline btn--sm" href={`tel:${d}`}>
            <Icon name="phone" size={14} /> Call
          </a>
          <a className="btn btn--outline btn--sm" href={`https://wa.me/${d}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

// A booking request from the public widget: structured detail + a direct decision
// (Approve & book creates the reservation right here; Decline dismisses it).
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
  const { confirm } = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const terminal = e.status === "resolved" || e.status === "dismissed";

  async function handleApprove() {
    const ok = await confirm({
      title: "Approve & book?",
      message: `This creates the reservation for ${meta.roomLabel} right away and can't be undone from here.`,
      confirmLabel: "Approve & book",
    });
    if (!ok) return;
    setError(null);
    const err = await onApprove();
    if (err) setError(err);
  }

  async function handleDecline() {
    const ok = await confirm({
      title: "Decline this request?",
      message: "The guest won't be booked. This can't be undone.",
      confirmLabel: "Decline",
      danger: true,
    });
    if (!ok) return;
    onDecline(note);
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="esc-block">
        <div className="esc-block__lbl">Booking request</div>
        <div style={{ fontWeight: 700, fontSize: "var(--fs-body)" }}>
          {meta.roomLabel} <span className="muted" style={{ fontWeight: 400 }}>· {meta.roomTypeName}</span>
        </div>
        <div style={{ fontSize: "var(--fs-small)", marginTop: 3 }}>
          {meta.checkIn && displayDMY(meta.checkIn)} → {meta.checkOut && displayDMY(meta.checkOut)}
          {meta.nights ? ` · ${meta.nights} night${meta.nights === 1 ? "" : "s"}` : ""}
        </div>
        {typeof meta.total === "number" && (
          <div style={{ fontWeight: 600, marginTop: 3 }}>{displayINR(meta.total)}</div>
        )}
      </div>

      {terminal ? (
        <div style={{ fontSize: "var(--fs-small)" }}>
          {e.status === "resolved" ? (
            <div style={{ color: "var(--green-text)", fontWeight: 600 }}>
              ✓ Booked
              {e.relatedType === "reservation" && e.relatedId && (
                <Link href={`/reservations/${e.relatedId}`} className="btn btn--outline btn--sm" style={{ marginLeft: 8 }}>
                  Open reservation
                </Link>
              )}
            </div>
          ) : (
            <div className="muted">Declined{e.resolutionNote ? ` — ${e.resolutionNote}` : ""}</div>
          )}
        </div>
      ) : (
        <>
          {error && (
            <div className="banner banner--danger" style={{ fontSize: "var(--fs-small)" }}>
              <span className="banner__txt">{error}</span>
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
              <div className="row" style={{ gap: 7 }}>
                <button className="btn btn--danger btn--sm" disabled={busy} onClick={handleDecline}>Confirm decline</button>
                <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setDeclining(false)}>Back</button>
              </div>
            </div>
          ) : (
            <div className="row" style={{ gap: 7 }}>
              <button className="btn btn--success btn--sm" disabled={busy} onClick={handleApprove}>
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
    <div style={{ display: "grid", gap: 9 }}>
      <div className="row" style={{ gap: 7, flexWrap: "wrap", alignItems: "center" }}>
        <label className="muted" style={{ fontSize: "var(--fs-small)" }}>Severity</label>
        <select
          className="select"
          value={e.severity}
          disabled={busy}
          onChange={(ev) => onPatch({ severity: ev.target.value })}
          style={{ width: "auto" }}
        >
          {["low", "medium", "high", "critical"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {e.status === "open" && (
          <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => onPatch({ status: "in_progress" })}>
            Claim
          </button>
        )}
        {!terminal && (
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => onPatch({ status: "dismissed" })}>
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
        <div style={{ display: "grid", gap: 7 }}>
          <textarea
            className="textarea"
            placeholder="Resolution note (optional)"
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            rows={2}
          />
          <button
            className="btn btn--success btn--sm"
            disabled={busy}
            style={{ justifySelf: "start" }}
            onClick={() => onPatch({ status: "resolved", resolutionNote: note || null })}
          >
            Resolve
          </button>
        </div>
      )}

      {terminal && e.resolutionNote && (
        <div className="muted" style={{ fontSize: "var(--fs-small)" }}>
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
