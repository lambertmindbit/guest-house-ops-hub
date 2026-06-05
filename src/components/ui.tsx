import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/* ---------------- Icons (Lucide-style stroke, currentColor) ---------------- */
const PATHS: Record<string, ReactNode> = {
  today: (<><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>),
  calendar: (<><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>),
  guests: (<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17.5 20a5.5 5.5 0 0 0-3-4.9" /></>),
  clean: (<><path d="M19 4 14 9" /><path d="m13.5 6.5 4 4" /><path d="M11 8.5 4.5 15a3 3 0 0 0 0 4.2h0a3 3 0 0 0 4.2 0L15 12.5" /><path d="M4.8 19.2 9 15" /></>),
  more: (<><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>),
  plus: (<><path d="M12 5v14M5 12h14" /></>),
  alert: (<><path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h0" /></>),
  check: (<><path d="M20 6 9 17l-5-5" /></>),
  chevronR: (<><path d="m9 6 6 6-6 6" /></>),
  chevronL: (<><path d="m15 6-6 6 6 6" /></>),
  arrowR: (<><path d="M5 12h14M13 6l6 6-6 6" /></>),
  arrowDown: (<><path d="M12 5v14M19 12l-7 7-7-7" /></>),
  arrowUp: (<><path d="M12 19V5M5 12l7-7 7 7" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
  wallet: (<><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 9h18M16 13h2" /></>),
  chart: (<><path d="M4 20V4M4 20h16" /><rect x="7.5" y="11" width="3" height="6" /><rect x="13" y="7.5" width="3" height="9.5" /></>),
  bed: (<><path d="M3 7v12M3 13h18v6M21 19v-5a3 3 0 0 0-3-3H9v4" /><circle cx="6.5" cy="10.5" r="1.6" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>),
  logout: (<><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="M16 17l5-5-5-5M21 12H9" /></>),
  x: (<><path d="M6 6l12 12M18 6 6 18" /></>),
  link: (<><path d="M9 13a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6L10.5 5.9" /><path d="M15 11a4 4 0 0 0-5.6 0l-3 3A4 4 0 0 0 12 19.6l1.5-1.5" /></>),
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>),
  receipt: (<><path d="M6 2h12a1 1 0 0 1 1 1v18l-3-2-3 2-3-2-3 2V3a1 1 0 0 1 1-1Z" /><path d="M9 7h6M9 11h6" /></>),
  edit: (<><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m14.5 5.5 4 4" /></>),
  trash: (<><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></>),
  door: (<><path d="M14 21V4a1 1 0 0 0-1.2-1L6 4.5A1 1 0 0 0 5 5.5V21M3 21h13M16 21h5M16 8v9" /><path d="M11 12v1" /></>),
  alertCircle: (<><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h0" /></>),
  phone: (<><path d="M5 4h3l1.5 4.5L7.5 10a12 12 0 0 0 6 6l1.5-2L19.5 16V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></>),
  checkCircle: (<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.8 2.5-2.8 2.5M12 17h0" /></>),
  moon: (<><path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>),
  tag: (<><path d="M3.5 12.5 11 5a2 2 0 0 1 1.4-.6l5.1 0a2 2 0 0 1 2 2v5.1a2 2 0 0 1-.6 1.4L11.5 20.5a2 2 0 0 1-2.8 0L3.5 15.3a2 2 0 0 1 0-2.8Z" /><circle cx="15.5" cy="8.5" r="1.2" /></>),
  inbox: (<><path d="M3 13h4l1.5 2.5h7L17 13h4" /><path d="M5 5h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></>),
};

export function Icon({ name, size = 22, stroke = 1.9, style, className }: { name: string; size?: number; stroke?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
      {PATHS[name] ?? null}
    </svg>
  );
}

/* ---------------- Channel badge ---------------- */
const CHANNEL_CLS: Record<string, string> = {
  Direct: "ch--direct",
  WhatsApp: "ch--whatsapp",
  "Booking.com": "ch--booking",
  Agoda: "ch--agoda",
  MakeMyTrip: "ch--makemytrip",
};
export function ChannelBadge({ name, dot = true }: { name: string; dot?: boolean }) {
  return (
    <span className={`ch ${CHANNEL_CLS[name] ?? "ch--direct"}`}>
      {dot && <span className="dot" />}
      {name}
    </span>
  );
}

/* ---------------- Status pill (maps onto the new badge system) ---------------- */
const PILL_MAP: Record<string, string> = { good: "badge--good", warn: "badge--warn", danger: "badge--danger", ink: "badge--neutral", teal: "badge--paid" };
export function StatusPill({ kind, children }: { kind: "good" | "warn" | "danger" | "ink" | "teal"; children: ReactNode }) {
  return <span className={`badge ${PILL_MAP[kind]}`}>{children}</span>;
}

/* ---------------- Page header ---------------- */
export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="pagehead">
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="display">{title}</div>
          {sub && <div className="pagehead__sub">{sub}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}

/* ---------------- Section label ---------------- */
export function SectionLabel({ children, count, action }: { children: ReactNode; count?: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-label">
      <div className="section-label__l">
        <span className="section-label__t">{children}</span>
        {count != null && <span className="section-label__c">{count}</span>}
      </div>
      {action}
    </div>
  );
}

/* ---------------- KPI card ---------------- */
const TONE_BG: Record<string, string> = { good: "var(--green-bg)", warn: "var(--amber-bg)", teal: "var(--accent-bg)", danger: "var(--red-bg)" };
const TONE_FG: Record<string, string> = { good: "var(--green-text)", warn: "var(--amber-text)", teal: "var(--accent-text)", danger: "var(--red-text)" };
export function KPI({ value, label, sub, tone, icon }: { value: ReactNode; label: string; sub?: string; tone?: "good" | "warn" | "teal" | "danger"; icon?: string }) {
  return (
    <div className="card" style={{ padding: 18, background: tone ? TONE_BG[tone] : "var(--surface)", borderColor: tone ? "transparent" : "var(--border)" }}>
      {icon && <div style={{ color: tone ? TONE_FG[tone] : "var(--accent-text)", marginBottom: 8 }}><Icon name={icon} size={20} /></div>}
      <div className="num" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1, color: tone ? TONE_FG[tone] : "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)", marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ---------------- Alert banner (links somewhere) ---------------- */
export function AlertBanner({ tone, icon, href, children }: { tone: "danger" | "warn" | "good"; icon: string; href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`banner banner--${tone}`}>
      <span className="banner__icon"><Icon name={icon} size={19} /></span>
      <span style={{ flex: 1 }}>{children}</span>
      <span className="banner__arrow"><Icon name="arrowR" size={18} /></span>
    </Link>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/* ---------------- Date range form (GET) ---------------- */
export function RangeForm({ from, to }: { from: string; to: string }) {
  return (
    <form method="get" className="card" style={{ padding: 14, marginTop: 16 }}>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <label className="field-label">From</label>
          <input className="input" type="date" name="from" defaultValue={from} />
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <label className="field-label">To</label>
          <input className="input" type="date" name="to" defaultValue={to} />
        </div>
        <button className="btn btn--ghost">Apply</button>
      </div>
    </form>
  );
}

/* ---------------- Guest/booking list row ---------------- */
export function GuestRow({ name, meta, channel, right, href }: { name: string; meta?: string; channel?: string; right?: ReactNode; href?: string }) {
  const inner = (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15.5 }}>{name}</div>
        {meta && <div style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 3 }}>{meta}</div>}
      </div>
      <div className="col" style={{ alignItems: "flex-end", gap: 5 }}>
        {channel && <ChannelBadge name={channel} />}
        {right && <span style={{ fontSize: 12.5, color: "var(--text-subtle)", fontWeight: 600 }}>{right}</span>}
      </div>
    </>
  );
  const style: CSSProperties = { width: "100%", textAlign: "left", padding: "16px 17px", display: "flex", alignItems: "center", gap: 12 };
  return href ? (
    <Link href={href} className="card" style={style}>{inner}</Link>
  ) : (
    <div className="card" style={style}>{inner}</div>
  );
}
