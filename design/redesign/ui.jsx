/* redesign/ui.jsx — shared primitives (Icon set ported from the app's ui.tsx,
   plus ChannelBadge / StatusBadge). Exported to window for the screen files. */
var RD_ICONS = {
  today: (<><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>),
  calendar: (<><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>),
  guests: (<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17.5 20a5.5 5.5 0 0 0-3-4.9" /></>),
  clean: (<><path d="M19 4 14 9" /><path d="m13.5 6.5 4 4" /><path d="M11 8.5 4.5 15a3 3 0 0 0 0 4.2a3 3 0 0 0 4.2 0L15 12.5" /><path d="M4.8 19.2 9 15" /></>),
  more: (<><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>),
  plus: (<><path d="M12 5v14M5 12h14" /></>),
  alert: (<><path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h0" /></>),
  check: (<><path d="M20 6 9 17l-5-5" /></>),
  chevronR: (<><path d="m9 6 6 6-6 6" /></>),
  chevronL: (<><path d="m15 6-6 6 6 6" /></>),
  arrowR: (<><path d="M5 12h14M13 6l6 6-6 6" /></>),
  arrowDown: (<><path d="M12 5v14M6 13l6 6 6-6" /></>),
  arrowUp: (<><path d="M12 19V5M6 11l6-6 6 6" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
  wallet: (<><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 9h18M16 13h2" /></>),
  chart: (<><path d="M4 20V4M4 20h16" /><rect x="7.5" y="11" width="3" height="6" /><rect x="13" y="7.5" width="3" height="9.5" /></>),
  bed: (<><path d="M3 7v12M3 13h18v6M21 19v-5a3 3 0 0 0-3-3H9v4" /><circle cx="6.5" cy="10.5" r="1.6" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>),
  logout: (<><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="M16 17l5-5-5-5M21 12H9" /></>),
  x: (<><path d="M6 6l12 12M18 6 6 18" /></>),
  link: (<><path d="M9 13a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6L10.5 5.9" /><path d="M15 11a4 4 0 0 0-5.6 0l-3 3A4 4 0 0 0 12 19.6l1.5-1.5" /></>),
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>),
  edit: (<><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m14.5 5.5 4 4" /></>),
  door: (<><path d="M14 21V4a1 1 0 0 0-1.2-1L6 4.5A1 1 0 0 0 5 5.5V21M3 21h13M16 21h5M16 8v9" /><path d="M11 12v1" /></>),
  phone: (<><path d="M5 4h3l1.5 4.5L7.5 10a12 12 0 0 0 6 6l1.5-2L19.5 16V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></>),
  moon: (<><path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>),
  tag: (<><path d="M3.5 12.5 11 5a2 2 0 0 1 1.4-.6h5.1a2 2 0 0 1 2 2v5.1a2 2 0 0 1-.6 1.4L11.5 20.5a2 2 0 0 1-2.8 0L3.5 15.3a2 2 0 0 1 0-2.8Z" /><circle cx="15.5" cy="8.5" r="1.2" /></>),
  inbox: (<><path d="M3 13h4l1.5 2.5h7L17 13h4" /><path d="M5 5h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></>),
  home: (<><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></>),
  building: (<><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>),
  receipt: (<><path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5Z" /><path d="M8 8h8M8 12h8" /></>),
  ban: (<><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>),
  bolt: (<><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></>),
  trash: (<><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></>),
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" /><path d="M12 17h0" /></>),
  logout: (<><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="M16 17l5-5-5-5M21 12H9" /></>),
};
function RDIcon({ name, size = 20, stroke = 1.9, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {RD_ICONS[name] || null}
    </svg>
  );
}
var RD_CH_CLS = { Direct: "ch--direct", WhatsApp: "ch--whatsapp", "Booking.com": "ch--booking", Agoda: "ch--agoda", MakeMyTrip: "ch--makemytrip" };
function ChannelBadge({ name }) {
  return <span className={"ch " + (RD_CH_CLS[name] || "ch--direct")}><span className="dot" />{name}</span>;
}
function StatusBadge({ kind, children }) {
  return <span className={"badge badge--" + kind}>{children}</span>;
}
var CH_DOT = { Direct: "#0f766e", WhatsApp: "#15803d", "Booking.com": "#2563eb", Agoda: "#e11d48", MakeMyTrip: "#ea580c" };
Object.assign(window, { RDIcon, ChannelBadge, StatusBadge, CH_DOT });
