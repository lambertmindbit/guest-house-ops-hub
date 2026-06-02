"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

type Night = { date: string; rate: number; isOverride: boolean; hasAdjust: boolean };
type Row = { id: string; name: string; nights: Night[] };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROOMW = 132;
const COLW = 74;

function parts(date: string) {
  const d = new Date(`${date}T00:00:00.000Z`);
  return { dow: DOW[d.getUTCDay()], day: String(d.getUTCDate()) };
}

type Selected = { typeId: string; typeName: string; date: string; rate: number; isOverride: boolean };

export function RateCalendar({
  dates,
  rows,
  today,
  currency,
}: {
  dates: string[];
  rows: Row[];
  today: string;
  currency: string;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Selected | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  function open(typeId: string, typeName: string, n: Night) {
    setSel({ typeId, typeName, date: n.date, rate: n.rate, isOverride: n.isOverride });
    setDraft(String(n.rate));
  }

  async function save() {
    if (!sel) return;
    const rate = Number(draft);
    if (!Number.isFinite(rate) || rate <= 0) return;
    setBusy(true);
    await fetch("/api/pricing/overrides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomTypeId: sel.typeId, date: sel.date, rate }),
    });
    setBusy(false);
    setSel(null);
    router.refresh();
  }

  async function clear() {
    if (!sel) return;
    setBusy(true);
    await fetch("/api/pricing/overrides", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomTypeId: sel.typeId, date: sel.date }),
    });
    setBusy(false);
    setSel(null);
    router.refresh();
  }

  const cols = `${ROOMW}px repeat(${dates.length}, ${COLW}px)`;

  return (
    <>
      <div className="card" style={{ overflow: "hidden", padding: 0 }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ minWidth: ROOMW + COLW * dates.length }}>
            {/* header */}
            <div style={{ display: "grid", gridTemplateColumns: cols, position: "sticky", top: 0 }}>
              <div style={{ position: "sticky", left: 0, zIndex: 3, background: "var(--sand)", padding: "11px 12px", fontWeight: 700, fontSize: 12.5, borderBottom: "1px solid var(--line)", borderRight: "1px solid var(--line)" }}>
                Room type
              </div>
              {dates.map((d, i) => {
                const isToday = d === today;
                const { dow, day } = parts(d);
                return (
                  <div key={d} style={{ padding: "9px 6px", textAlign: "center", borderBottom: "1px solid var(--line)", borderRight: i < dates.length - 1 ? "1px solid var(--line)" : 0, background: isToday ? "var(--teal-50)" : "var(--sand)" }}>
                    <div className="eyebrow" style={{ fontSize: 9.5, color: isToday ? "var(--teal-700)" : "var(--subtle)" }}>{dow}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: isToday ? "var(--teal-700)" : "var(--ink)" }}>{day}</div>
                  </div>
                );
              })}
            </div>
            {/* rows */}
            {rows.map((row, ri) => (
              <div key={row.id} style={{ display: "grid", gridTemplateColumns: cols }}>
                <div style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--paper)", padding: "10px 12px", borderRight: "1px solid var(--line)", borderBottom: ri < rows.length - 1 ? "1px solid var(--line)" : 0, fontWeight: 700, fontSize: 13.5 }}>
                  {row.name}
                </div>
                {row.nights.map((n, di) => (
                  <button
                    key={n.date}
                    onClick={() => open(row.id, row.name, n)}
                    style={{
                      padding: "10px 4px",
                      textAlign: "center",
                      fontSize: 12.5,
                      fontWeight: n.isOverride ? 700 : 500,
                      fontStyle: n.hasAdjust ? "italic" : "normal",
                      color: n.isOverride ? "var(--teal-700)" : "var(--ink)",
                      background: n.isOverride ? "var(--teal-50)" : "var(--paper)",
                      borderRight: di < dates.length - 1 ? "1px solid var(--line)" : 0,
                      borderBottom: ri < rows.length - 1 ? "1px solid var(--line)" : 0,
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    {n.isOverride && <span style={{ position: "absolute", top: 4, right: 5, width: 5, height: 5, borderRadius: 5, background: "var(--teal-700)" }} />}
                    {n.rate.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {sel && (
        <div className="tweaks-backdrop" onClick={() => setSel(null)}>
          <div className="tweaks" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="tweaks__hd">
              <b>{sel.typeName} · {sel.date}</b>
              <button className="chrome-btn" onClick={() => setSel(null)} aria-label="Close"><Icon name="x" size={17} /></button>
            </div>
            <div className="tweaks__body">
              <label className="field-label">Override rate ({currency})</label>
              <input
                className="input"
                type="number"
                min="1"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <p style={{ fontSize: 12.5, color: "var(--subtle)", margin: "8px 0 0", lineHeight: 1.5 }}>
                Pinning a rate overrides the pricing rules for this date. Clear it to fall back to the calculated rate.
              </p>
              <div className="row" style={{ gap: 10, marginTop: 16 }}>
                <button onClick={save} disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save override"}</button>
                {sel.isOverride && <button onClick={clear} disabled={busy} className="btn btn--danger-outline btn--sm">Clear</button>}
                <button onClick={() => setSel(null)} className="btn btn--ghost btn--sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
