import { Icon } from "@/components/ui";
import { displayShortDate } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";

// Shared types, the settings fetch helper, and the small presentational bits used
// across the settings sections. Each section lives in its own file and imports
// from here; sections.tsx re-exports them so page imports stay unchanged.

// Shared, consistent date rendering (e.g. "1 Jun 2026") from a YYYY-MM-DD string.
export const fmtDate = (iso: string) => displayShortDate(parseDateOnly(iso));

export type RoomType = {
  id: string;
  name: string;
  baseRate: number;
  maxOccupancy: number;
  rateFloor: number;
  rateCeiling: number;
  roomCount: number;
};
export type Room = {
  id: string; label: string; roomTypeId: string; roomTypeName: string; archived: boolean;
  photos: string[]; facing: string | null; view: string | null;
};
export type Channel = { id: string; name: string; commissionPct: number; collectsPayment: boolean; resCount: number };
export type Agent = { id: string; name: string; phone: string | null; commissionPct: number; verified: boolean; active: boolean; notes: string | null; resCount: number; commissionThisMonth: number };
export type Block = { id: string; roomId: string; roomLabel: string; startDate: string; endDate: string; reason: string | null };
export type Settings = {
  name: string;
  checkInTime: string;
  checkOutTime: string;
  currency: string;
  timezone: string;
  address: string | null;
  gstNumber: string | null;
  upiVpa: string | null;
  idRetentionDays: number | null;
  idPolicy: string;
  idRequiredAtBooking: boolean;
} | null;
export type Policy = {
  enabled: boolean;
  weekendDays: number[];
  weekendAdjustPct: number;
  leadEarlyDays: number | null;
  leadEarlyAdjustPct: number | null;
  leadLateDays: number | null;
  leadLateAdjustPct: number | null;
  occupancyThresholdPct: number | null;
  occupancyAdjustPct: number | null;
};
export type Season = { id: string; name: string; startDate: string; endDate: string; adjustPct: number };

export async function send(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Something went wrong." };
}

export function ErrorLine({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="field-error" style={{ margin: "0 0 10px" }}>{msg}</p>;
}

export function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <span className="row" style={{ gap: 4, flex: "none" }}>
      {onEdit && (
        <button className="btn btn--quiet btn--icon btn--sm" onClick={onEdit} aria-label="Edit"><Icon name="edit" size={16} /></button>
      )}
      {onDelete && (
        <button className="btn btn--quiet btn--icon btn--sm" onClick={onDelete} aria-label="Delete" style={{ color: "var(--red-text)" }}><Icon name="trash" size={16} /></button>
      )}
    </span>
  );
}

export function ListItem({ title, meta, actions }: { title: string; meta: string; actions: React.ReactNode }) {
  return (
    <div className="card card--pad" style={{ padding: 14 }}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="h3" style={{ fontSize: "var(--fs-h3)" }}>{title}</div>
          <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 3 }}>{meta}</div>
        </div>
        {actions}
      </div>
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
      <button onClick={onClick} className="btn btn--ghost btn--sm"><Icon name="plus" size={15} /> {label}</button>
    </div>
  );
}
