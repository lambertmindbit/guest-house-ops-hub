"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmProvider";
import { send, fmtDate, ErrorLine, ListItem, RowActions, type Policy, type Season } from "./shared";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
const BLANK_SEASON = { name: "", startDate: "", endDate: "", adjustPct: "" };

export function PricingSection({ policy, seasons }: { policy: Policy; seasons: Season[] }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [p, setP] = useState({
    enabled: policy.enabled,
    weekendDays: new Set(policy.weekendDays),
    weekendAdjustPct: String(policy.weekendAdjustPct),
    leadEarlyDays: policy.leadEarlyDays?.toString() ?? "",
    leadEarlyAdjustPct: policy.leadEarlyAdjustPct?.toString() ?? "",
    leadLateDays: policy.leadLateDays?.toString() ?? "",
    leadLateAdjustPct: policy.leadLateAdjustPct?.toString() ?? "",
    occupancyThresholdPct: policy.occupancyThresholdPct?.toString() ?? "",
    occupancyAdjustPct: policy.occupancyAdjustPct?.toString() ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleDay(d: number) {
    const next = new Set(p.weekendDays);
    if (next.has(d)) next.delete(d); else next.add(d);
    setP({ ...p, weekendDays: next });
  }

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    const r = await send("PATCH", "/api/pricing/policy", {
      enabled: p.enabled,
      weekendDays: [...p.weekendDays].sort(),
      weekendAdjustPct: Number(p.weekendAdjustPct || 0),
      leadEarlyDays: numOrNull(p.leadEarlyDays),
      leadEarlyAdjustPct: numOrNull(p.leadEarlyAdjustPct),
      leadLateDays: numOrNull(p.leadLateDays),
      leadLateAdjustPct: numOrNull(p.leadLateAdjustPct),
      occupancyThresholdPct: numOrNull(p.occupancyThresholdPct),
      occupancyAdjustPct: numOrNull(p.occupancyAdjustPct),
    });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setSaved(true); router.refresh();
  }

  // Seasons sub-form (now supports edit)
  const [editingSeason, setEditingSeason] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [s, setS] = useState(BLANK_SEASON);
  const [sErr, setSErr] = useState<string | null>(null);

  function startAddSeason() { setSErr(null); setEditingSeason(null); setS(BLANK_SEASON); setAdding(true); }
  function startEditSeason(season: Season) {
    setSErr(null); setAdding(false); setEditingSeason(season.id);
    setS({ name: season.name, startDate: season.startDate, endDate: season.endDate, adjustPct: String(season.adjustPct) });
  }

  async function submitSeason(e: React.FormEvent) {
    e.preventDefault();
    setSErr(null);
    const payload = { name: s.name, startDate: s.startDate, endDate: s.endDate, adjustPct: Number(s.adjustPct || 0) };
    const r = editingSeason ? await send("PATCH", `/api/seasons/${editingSeason}`, payload) : await send("POST", "/api/seasons", payload);
    if (!r.ok) return setSErr(r.error!);
    setS(BLANK_SEASON); setAdding(false); setEditingSeason(null); router.refresh();
  }
  async function removeSeason(id: string) {
    if (!(await confirm({ title: "Delete season", message: "Delete this season?", danger: true, confirmLabel: "Delete" }))) return;
    await send("DELETE", `/api/seasons/${id}`);
    router.refresh();
  }

  const seasonFormOpen = adding || editingSeason !== null;

  return (
    <>
      <p className="muted" style={{ fontSize: "var(--fs-small)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Advisory only — these suggest a nightly rate and pre-fill new bookings, clamped to each room type&apos;s floor/ceiling. Never pushed to OTAs.
      </p>

      <div className="card card--pad">
        <ErrorLine msg={error} />
        <div className="spread" style={{ padding: "2px 0 14px" }}>
          <label style={{ fontWeight: 600 }}>Pricing engine</label>
          <button type="button" className={`switch${p.enabled ? " on" : ""}`} onClick={() => setP({ ...p, enabled: !p.enabled })} aria-label="Toggle pricing"><span /></button>
        </div>

        <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Weekend</div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {DAY_LABELS.map((lbl, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)} className={`chip${p.weekendDays.has(i) ? " on" : ""}`} style={{ minWidth: 42, justifyContent: "center" }}>{lbl}</button>
          ))}
        </div>
        <div style={{ maxWidth: 220, marginBottom: 18 }}>
          <label className="field-label">Weekend adjustment %</label>
          <input className="input" type="number" value={p.weekendAdjustPct} onChange={(e) => setP({ ...p, weekendAdjustPct: e.target.value })} placeholder="e.g. 20" />
        </div>

        <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Lead time</div>
        <div className="form-grid" style={{ marginBottom: 18 }}>
          <div><label className="field-label">Early-bird if ≥ days out</label><input className="input" type="number" min="0" value={p.leadEarlyDays} onChange={(e) => setP({ ...p, leadEarlyDays: e.target.value })} placeholder="e.g. 30" /></div>
          <div><label className="field-label">Early-bird adjustment %</label><input className="input" type="number" value={p.leadEarlyAdjustPct} onChange={(e) => setP({ ...p, leadEarlyAdjustPct: e.target.value })} placeholder="e.g. -10" /></div>
          <div><label className="field-label">Last-minute if ≤ days out</label><input className="input" type="number" min="0" value={p.leadLateDays} onChange={(e) => setP({ ...p, leadLateDays: e.target.value })} placeholder="e.g. 3" /></div>
          <div><label className="field-label">Last-minute adjustment %</label><input className="input" type="number" value={p.leadLateAdjustPct} onChange={(e) => setP({ ...p, leadLateAdjustPct: e.target.value })} placeholder="e.g. 15" /></div>
        </div>

        <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Occupancy — high demand</div>
        <div className="form-grid">
          <div><label className="field-label">When occupancy ≥ %</label><input className="input" type="number" min="0" max="100" value={p.occupancyThresholdPct} onChange={(e) => setP({ ...p, occupancyThresholdPct: e.target.value })} placeholder="e.g. 80" /></div>
          <div><label className="field-label">Adjustment %</label><input className="input" type="number" value={p.occupancyAdjustPct} onChange={(e) => setP({ ...p, occupancyAdjustPct: e.target.value })} placeholder="e.g. 15" /></div>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button onClick={save} disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save pricing rules"}</button>
          {saved && <span style={{ fontSize: "var(--fs-small)", color: "var(--green-text)", fontWeight: 600 }}>Saved</span>}
        </div>
      </div>

      <div className="section-label">
        <div className="section-label__l">
          <span className="section-label__t">Seasons &amp; holidays</span>
          <span className="section-label__c">{seasons.length}</span>
        </div>
        <button onClick={startAddSeason} className="section-label__a"><Icon name="plus" size={13} /> Add season</button>
      </div>

      {seasonFormOpen && (
        <form onSubmit={submitSeason} className="card card--pad" style={{ marginBottom: 12 }}>
          <div className="h3" style={{ marginBottom: 10 }}>{editingSeason ? "Edit season" : "New season"}</div>
          <ErrorLine msg={sErr} />
          <div className="form-grid">
            <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Name <span className="req">*</span></label><input className="input" required value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="e.g. Diwali week" /></div>
            <div><label className="field-label">From</label><input className="input" required type="date" value={s.startDate} onChange={(e) => setS({ ...s, startDate: e.target.value })} /></div>
            <div><label className="field-label">To</label><input className="input" required type="date" value={s.endDate} onChange={(e) => setS({ ...s, endDate: e.target.value })} /></div>
            <div><label className="field-label">Adjustment %</label><input className="input" required type="number" value={s.adjustPct} onChange={(e) => setS({ ...s, adjustPct: e.target.value })} placeholder="e.g. 40" /></div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button type="submit" className="btn btn--primary btn--sm">{editingSeason ? "Save season" : "Add season"}</button>
            <button type="button" onClick={() => { setAdding(false); setEditingSeason(null); }} className="btn btn--ghost btn--sm">Cancel</button>
          </div>
        </form>
      )}

      {seasons.length === 0 ? (
        <div className="empty">No seasons defined.</div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {seasons.map((season) => (
            <ListItem
              key={season.id}
              title={season.name}
              meta={`${fmtDate(season.startDate)} – ${fmtDate(season.endDate)} · ${season.adjustPct > 0 ? "+" : ""}${season.adjustPct}%`}
              actions={<RowActions onEdit={() => startEditSeason(season)} onDelete={() => removeSeason(season.id)} />}
            />
          ))}
        </div>
      )}
    </>
  );
}
