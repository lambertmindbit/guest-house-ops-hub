"use client";

import { displayINR } from "@/lib/format";
import type { UIComponent } from "@/lib/assistant/types";

// The generative-UI registry: maps an assistant-emitted descriptor { type, data }
// to a React component, built on the existing design system (card / btn / badge /
// tokens). The assistant "renders UI" by emitting these; adding a card type later
// is one case here + one type in lib/assistant/types.ts.

type Action = (message: string) => void;

export function RenderComponent({ component, onAction, disabled }: { component: UIComponent; onAction: Action; disabled: boolean }) {
  switch (component.type) {
    case "rooms":
      return <RoomsCards c={component} onAction={onAction} disabled={disabled} />;
    case "quote":
      return <QuoteCard c={component} onAction={onAction} disabled={disabled} />;
    case "confirm_booking":
      return <ConfirmCard c={component} onAction={onAction} disabled={disabled} />;
    case "availability":
      return <AvailabilityCard c={component} />;
  }
}

function RoomsCards({ c, onAction, disabled }: { c: Extract<UIComponent, { type: "rooms" }>; onAction: Action; disabled: boolean }) {
  const { data, checkIn, checkOut } = c;
  return (
    <div className="col" style={{ gap: 8, marginTop: 8 }}>
      {data.map((r) => (
        <div key={r.id} className="rowcard">
          <div className="rowcard__main">
            <div className="rowcard__name">{r.label} <span className="badge badge--neutral" style={{ marginLeft: 6 }}>{r.roomTypeName}</span></div>
            <div className="rowcard__meta">Sleeps {r.maxOccupancy} · <b className="num" style={{ color: "var(--ink)" }}>{displayINR(r.rate)}</b>/night</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn--ghost btn--sm" disabled={disabled} onClick={() => onAction(`/quote ${r.id} ${checkIn} ${checkOut}`)}>Price</button>
            <button className="btn btn--primary btn--sm" disabled={disabled} onClick={() => onAction(`/book ${r.id} ${checkIn} ${checkOut}`)}>Book</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuoteCard({ c, onAction, disabled }: { c: Extract<UIComponent, { type: "quote" }>; onAction: Action; disabled: boolean }) {
  const { data: q } = c;
  return (
    <div className="card card--pad" style={{ marginTop: 8, maxWidth: 340 }}>
      <div style={{ fontWeight: 600 }}>{q.roomLabel} <span className="muted" style={{ fontWeight: 400 }}>· {q.roomTypeName}</span></div>
      <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>{q.checkIn} → {q.checkOut} · {q.nights} night{q.nights === 1 ? "" : "s"}</div>
      <div className="spread" style={{ marginTop: 10, alignItems: "baseline" }}>
        <span className="muted" style={{ fontSize: "var(--fs-small)" }}>Total</span>
        <span className="num" style={{ fontSize: 22, fontWeight: 700 }}>{displayINR(q.total)}</span>
      </div>
      <button className="btn btn--primary btn--sm btn--block" style={{ marginTop: 10 }} disabled={disabled} onClick={() => onAction(`/book ${q.roomId} ${q.checkIn} ${q.checkOut}`)}>Book this room</button>
    </div>
  );
}

function ConfirmCard({ c, onAction, disabled }: { c: Extract<UIComponent, { type: "confirm_booking" }>; onAction: Action; disabled: boolean }) {
  const { data: b } = c;
  return (
    <div className="card card--pad" style={{ marginTop: 8, maxWidth: 360, borderColor: "var(--accent-border, var(--border))" }}>
      <div className="eyebrow eyebrow--accent">Confirm booking</div>
      <div style={{ fontWeight: 600, marginTop: 4 }}>{b.roomLabel} <span className="muted" style={{ fontWeight: 400 }}>· {b.roomTypeName}</span></div>
      <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>{b.checkIn} → {b.checkOut} · {b.nights} night{b.nights === 1 ? "" : "s"}</div>
      <div className="spread" style={{ marginTop: 8, alignItems: "baseline" }}>
        <span className="muted" style={{ fontSize: "var(--fs-small)" }}>Total</span>
        <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{displayINR(b.total)}</span>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 12 }}>
        <button className="btn btn--primary btn--sm" style={{ flex: 1 }} disabled={disabled} onClick={() => onAction(`/confirm ${b.roomId} ${b.checkIn} ${b.checkOut}`)}>Confirm</button>
        <button className="btn btn--ghost btn--sm" disabled={disabled} onClick={() => onAction("cancel")}>Not now</button>
      </div>
    </div>
  );
}

function AvailabilityCard({ c }: { c: Extract<UIComponent, { type: "availability" }> }) {
  const { data } = c;
  return (
    <div className="card card--pad" style={{ marginTop: 8, maxWidth: 360 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{data.roomTypeName}</div>
      <div className="col" style={{ gap: 3 }}>
        {data.nights.map((n) => (
          <div key={n.date} className="spread" style={{ fontSize: "var(--fs-small)" }}>
            <span className="muted">{n.date}</span>
            <span className="num">{n.available} / {n.total} free</span>
          </div>
        ))}
      </div>
    </div>
  );
}
