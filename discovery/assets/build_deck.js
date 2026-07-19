/* Guest House Ops Hub — Requirements Deck (IDM document-family style, navy/teal). */
const pptxgen = require("pptxgenjs");
const path = require("path");
const OUT = path.resolve(__dirname, "..", "Ops-Hub-Requirements-Deck.pptx");

const P = new pptxgen();
P.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
const W = 13.33, H = 7.5;

const BG = "0D1F2A", PANEL = "132A3A", PANEL2 = "0F2432",
      INK = "EAF6F2", MUT = "8FB6AB", TEAL = "0FA68E", MINT = "5ED4BE",
      RED = "E4685A", AMBER = "E8B34B", LINE = "23425A";
const F = "Arial";

function base(s, kicker, num) {
  s.background = { color: BG };
  // brand edge bars (document-family motif)
  s.addShape("rect", { x: 0, y: 0, w: 0.07, h: H, fill: { color: TEAL } });
  s.addShape("rect", { x: W - 0.07, y: 0, w: 0.07, h: H, fill: { color: "173447" } });
  if (kicker) s.addText(kicker.toUpperCase(), { x: 0.75, y: 0.52, w: 10.5, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: MINT, charSpacing: 4, margin: 0 });
  if (num) s.addText(num, { x: W - 1.35, y: 0.52, w: 0.6, h: 0.3, fontFace: F, fontSize: 11, color: MUT, align: "right", margin: 0 });
  s.addText("MindBit Solutions LLP · Confidential — for the build team", { x: 0.75, y: H - 0.42, w: 7, h: 0.25, fontFace: F, fontSize: 9, color: "5F7D74", margin: 0 });
}
function title(s, txt, y = 0.92, size = 34, w = 11.8) {
  s.addText(txt, { x: 0.75, y, w, h: 1.0, fontFace: F, fontSize: size, bold: true, color: INK, margin: 0, valign: "top" });
}
function stat(s, x, y, big, small, color = INK, w = 2.2) {
  s.addText(big, { x, y, w, h: 0.62, fontFace: F, fontSize: 34, bold: true, color, margin: 0 });
  s.addText(small, { x, y: y + 0.62, w, h: 0.5, fontFace: F, fontSize: 10.5, color: MUT, margin: 0 });
}
function card(s, x, y, w, h, head, body, headColor = MINT, bodySize = 11.5) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.07, fill: { color: PANEL }, line: { color: LINE, width: 0.75 } });
  s.addText(head, { x: x + 0.22, y: y + 0.16, w: w - 0.44, h: 0.34, fontFace: F, fontSize: 13.5, bold: true, color: headColor, margin: 0 });
  s.addText(body, { x: x + 0.22, y: y + 0.52, w: w - 0.44, h: h - 0.68, fontFace: F, fontSize: bodySize, color: INK, margin: 0, valign: "top", lineSpacingMultiple: 1.12 });
}
function bullets(s, x, y, w, h, items, size = 12.5) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: { code: "2022", indent: 14 }, color: INK, fontSize: size, breakLine: true, paraSpaceAfter: 8 } })),
    { x, y, w, h, fontFace: F, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
}

/* 1 — Title */
{
  const s = P.addSlide(); base(s, "", "");
  s.background = { color: "0A1822" };
  s.addShape("rect", { x: 0, y: 0, w: 0.07, h: H, fill: { color: TEAL } });
  s.addShape("rect", { x: W - 0.07, y: 0, w: 0.07, h: H, fill: { color: "173447" } });
  s.addShape("roundRect", { x: 0.85, y: 1.05, w: 0.52, h: 0.52, rectRadius: 0.1, fill: { color: TEAL } });
  s.addText("GH", { x: 0.85, y: 1.05, w: 0.52, h: 0.52, fontFace: F, fontSize: 15, bold: true, color: "07231D", align: "center", valign: "middle", margin: 0 });
  s.addText("Guest House Operations Hub", { x: 1.5, y: 1.02, w: 8, h: 0.3, fontFace: F, fontSize: 12.5, bold: true, color: INK, margin: 0 });
  s.addText("ROOT PLATFORM · SHILLONG, MEGHALAYA", { x: 1.5, y: 1.3, w: 8, h: 0.25, fontFace: F, fontSize: 8.5, color: MUT, charSpacing: 3, margin: 0 });
  s.addText("REQUIREMENTS & BUILD REFERENCE", { x: 0.85, y: 2.15, w: 10, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: MINT, charSpacing: 5, margin: 0 });
  s.addText("Guest House\nOperations Hub", { x: 0.82, y: 2.5, w: 11.6, h: 2.5, fontFace: F, fontSize: 63, bold: true, color: "FFFFFF", margin: 0, lineSpacingMultiple: 0.98 });
  s.addText("One source of truth for a small property — bookings, calendar, guests, money, housekeeping,\nteam, and a regional trust network — with an always-on multilingual AI layer in front.",
    { x: 0.85, y: 5.15, w: 11.3, h: 0.85, fontFace: F, fontSize: 15.5, color: "B9D6CD", margin: 0, lineSpacingMultiple: 1.15 });
  s.addText([
    { text: "Prepared by  ", options: { color: MUT } }, { text: "MindBit Solutions LLP", options: { color: INK, bold: true } },
    { text: "      |      Companion to  ", options: { color: MUT } }, { text: "BRD v1.0 · SRS v1.0 · Discovery docs 01–17", options: { color: INK, bold: true } },
    { text: "      |      Date  ", options: { color: MUT } }, { text: "16 July 2026", options: { color: INK, bold: true } },
  ], { x: 0.85, y: 6.35, w: 11.5, h: 0.3, fontFace: F, fontSize: 10.5, margin: 0 });
}

/* 2 — In one line + stats */
{
  const s = P.addSlide(); base(s, "The product, in one line", "02");
  s.addText([
    { text: "A right-sized, India-ready operations hub that retires the ", options: { color: INK } },
    { text: "paper registers, WhatsApp chaos and OTA guesswork", options: { color: MINT } },
    { text: " of a small guest house — with ", options: { color: INK } },
    { text: "double-booking made impossible", options: { color: MINT } },
    { text: " at the database and an ", options: { color: INK } },
    { text: "AI layer that never touches money", options: { color: MINT } },
    { text: ".", options: { color: INK } },
  ], { x: 0.75, y: 1.35, w: 11.6, h: 2.3, fontFace: F, fontSize: 30, bold: true, margin: 0, lineSpacingMultiple: 1.12, valign: "top" });
  stat(s, 0.78, 4.5, "55", "Prisma models,\nall phases in production", INK);
  stat(s, 3.2, 4.5, "18", "discovery documents,\nfully traceable", INK);
  stat(s, 5.6, 4.5, "30", "prioritized gaps\nto enterprise quality", AMBER);
  stat(s, 8.0, 4.5, "50", "backlog stories\n(P0 ≈ 67 points)", INK);
  stat(s, 10.4, 4.5, "25+", "businesses in 12 months\n(PRIME grant plan)", MINT);
  s.addText("Sources: MindBit pitch deck · USER-GUIDE · repo README / ROADMAP / schema. Every claim tagged FACT / INFERRED / REC / OPEN-Q in the package.",
    { x: 0.78, y: 6.3, w: 11.5, h: 0.3, fontFace: F, fontSize: 10, italic: true, color: MUT, margin: 0 });
}

/* 3 — The problem */
{
  const s = P.addSlide(); base(s, "The problem", "03");
  title(s, "Small operators run on manual coordination — and it leaks money.");
  const steps = [
    ["Booking arrives", "Phone call or WhatsApp — often after hours, missed entirely"],
    ["Human relay", "Operator reads, interprets, decides; Khasi ↔ English by hand"],
    ["No shared state", "Rooms in one head, drivers by phone, spreadsheets by hand"],
    ["No source of truth", "No history, no analytics — and OTAs each keep their own count"],
  ];
  steps.forEach(([h, b], i) => card(s, 0.75 + i * 3.02, 2.3, 2.85, 2.1, `${i + 1} · ${h}`, b));
  s.addShape("roundRect", { x: 0.75, y: 4.85, w: 11.83, h: 1.35, rectRadius: 0.07, fill: { color: "27201C" }, line: { color: "6B4A3A", width: 0.75 } });
  s.addText([{ text: "How a double-booking happens:  ", options: { bold: true, color: AMBER } },
    { text: "1 room left → booked on your website → Booking.com never hears about it → still shows 1 → a second guest books there → two guests, one room.", options: { color: INK } }],
    { x: 1.0, y: 5.05, w: 11.3, h: 1.0, fontFace: F, fontSize: 13.5, margin: 0, valign: "middle", lineSpacingMultiple: 1.15 });
}

/* 4 — Architectural reality */
{
  const s = P.addSlide(); base(s, "The architectural reality — read this before estimating", "04");
  title(s, "Deliberately not a channel manager.", 0.92, 34, 11.8);
  s.addText("Real-time OTA connectivity APIs are gated to certified channel-manager partners. A single small property cannot get them. The product design accepts this and wins elsewhere.",
    { x: 0.75, y: 1.62, w: 11.6, h: 0.65, fontFace: F, fontSize: 14, color: MUT, margin: 0 });
  card(s, 0.75, 2.5, 5.8, 3.6, "WHAT IT IS", "", MINT);
  bullets(s, 1.0, 3.05, 5.35, 3.0, [
    "Internal system of record — bookings, calendar, guests, money, ops",
    "Ingests OTA bookings via the owner's own emails + iCal feeds",
    "Pushes availability out via free iCal export",
    "Internally bulletproof: DB-enforced no-double-booking",
    "Sits happily alongside a paid channel manager later",
  ], 12.5);
  card(s, 6.8, 2.5, 5.8, 3.6, "WHAT IT WILL NEVER DO (hard rules)", "", RED);
  bullets(s, 7.05, 3.05, 5.35, 3.0, [
    "No scraping / browser automation against OTA extranets",
    "No direct Booking.com / Agoda / MMT API integration",
    "No availability stored as a mutable counter — always derived",
    "No weakening of the DB exclusion constraint, for any feature",
    "No pushing rates to OTAs (impossible for a single property)",
  ], 12.5);
  s.addText("Honest residual limit: free tools (email + iCal) are not real-time — a small cross-channel window remains. Mitigation ladder: safety buffer → hourly sync → paired channel manager.",
    { x: 0.75, y: 6.35, w: 11.8, h: 0.5, fontFace: F, fontSize: 11, italic: true, color: MUT, margin: 0 });
}

/* 5 — What's already built */
{
  const s = P.addSlide(); base(s, "Where the prototype actually is", "05");
  title(s, "This is a late-stage MVP, not a sketch — all milestones report in production.");
  const rows = [
    ["Operations core", "Bookings · calendar · Today board · guests · housekeeping · admin · blocks"],
    ["Money & commercial", "Payments (5 modes) · UPI link + QR · scam-verification checklist · advances · refund ladder · travel agents · finance · invoices"],
    ["Growth & intelligence", "Advisory pricing engine · analytics (occupancy / ADR / RevPAR) · CSV exports"],
    ["Team & facilities", "Staff / shifts / attendance · maintenance + assets · inventory · vendors + POs · tours · transport records · complaints · reviews"],
    ["Platform", "Multi-property + RBAC (owner / reception / housekeeping) · audit log · CSV import · PWA · offline tolerance"],
    ["AI & network", "Token-gated agent seam (availability / quote / book / escalate / message) · HITL escalations · community network (referrals, shared alerts)"],
  ];
  rows.forEach(([h, b], i) => {
    const y = 2.15 + i * 0.72;
    s.addShape("roundRect", { x: 0.75, y, w: 11.83, h: 0.62, rectRadius: 0.06, fill: { color: i % 2 ? PANEL2 : PANEL }, line: { color: LINE, width: 0.5 } });
    s.addText(h, { x: 1.0, y: y + 0.06, w: 2.6, h: 0.5, fontFace: F, fontSize: 12.5, bold: true, color: MINT, margin: 0, valign: "middle" });
    s.addText(b, { x: 3.7, y: y + 0.06, w: 8.7, h: 0.5, fontFace: F, fontSize: 10.5, color: INK, margin: 0, valign: "middle" });
  });
  s.addText("Built behind clean seams, off by default: email auto-ingestion · WhatsApp adapter · Razorpay + room-hold · ID-document storage.",
    { x: 0.75, y: 6.6, w: 11.8, h: 0.35, fontFace: F, fontSize: 11, italic: true, color: AMBER, margin: 0 });
}

/* 6 — Correctness core */
{
  const s = P.addSlide(); base(s, "The correctness core — protect these three decisions", "06");
  title(s, "Three design choices most commercial PMS products get wrong.");
  card(s, 0.75, 2.25, 3.85, 3.7, "1 · DB-ENFORCED NO-DOUBLE-BOOKING",
    "A Postgres GiST exclusion constraint on Reservation (room, stay-DATERANGE, status=confirmed).\n\nTwo confirmed stays for one room cannot overlap — not app code, the database itself. Violations surface as a friendly 409, never a raw 500.", MINT, 12);
  card(s, 4.75, 2.25, 3.85, 3.7, "2 · AVAILABILITY IS DERIVED",
    "Free rooms = units − overlapping confirmed stays − blocks. Computed at read time, never stored.\n\nNo counter to drift, no sync bug that can corrupt truth. Balance due, advance status, commissions and referral credit follow the same doctrine.", MINT, 12);
  card(s, 8.75, 2.25, 3.85, 3.7, "3 · HUMAN-IN-THE-LOOP AI",
    "Agents reach the app only through a token-gated seam: query, quote, book (same constraint), message, escalate.\n\nAnything sensitive — money, cancellations — files an escalation for a human to commit through normal, audited screens.", MINT, 12);
  s.addText("Engineering rule that keeps this true: migrations only via the safe helper — Prisma's diff engine mangles DATERANGE + GiST. The most fragile area of the repo.",
    { x: 0.75, y: 6.3, w: 11.8, h: 0.4, fontFace: F, fontSize: 11, italic: true, color: MUT, margin: 0 });
}

/* 7 — How bookings arrive */
{
  const s = P.addSlide(); base(s, "One calendar, five ways in", "07");
  title(s, "Every channel lands in the same conflict-checked transaction.");
  const chans = [
    ["Walk-in / phone", "Reception keys it in — 60-second form, price pre-filled by the engine"],
    ["WhatsApp / AI assistant", "Guest chats in Khasi, Hindi or English; the agent books via the seam"],
    ["Own website", "Direct bookings, zero commission"],
    ["OTA email (Inbox)", "Confirmation parsed → human reviews → Create. Nothing books itself"],
    ["OTA iCal import", "Their busy dates become blocks here, daily + on demand"],
  ];
  chans.forEach(([h, b], i) => {
    const y = 2.2 + i * 0.78;
    s.addShape("roundRect", { x: 0.75, y, w: 6.7, h: 0.68, rectRadius: 0.06, fill: { color: PANEL }, line: { color: LINE, width: 0.5 } });
    s.addText(h, { x: 1.0, y: y + 0.07, w: 2.3, h: 0.54, fontFace: F, fontSize: 12, bold: true, color: INK, margin: 0, valign: "middle" });
    s.addText(b, { x: 3.35, y: y + 0.07, w: 4.0, h: 0.54, fontFace: F, fontSize: 10, color: MUT, margin: 0, valign: "middle" });
    s.addShape("line", { x: 7.45, y: y + 0.34, w: 0.55, h: 0, line: { color: TEAL, width: 1.5, endArrowType: "arrow" } });
  });
  s.addShape("roundRect", { x: 8.15, y: 2.6, w: 4.4, h: 3.2, rectRadius: 0.08, fill: { color: "0E2A24" }, line: { color: TEAL, width: 1.2 } });
  s.addText("THE GiST GATE", { x: 8.4, y: 2.85, w: 3.9, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: MINT, charSpacing: 3, margin: 0 });
  s.addText("Same DB transaction for every path.\n\nFree → confirmed on the calendar, confirmation message drafted.\n\nTaken → clean 409: “those dates are no longer available.”",
    { x: 8.4, y: 3.25, w: 3.9, h: 2.4, fontFace: F, fontSize: 12.5, color: INK, margin: 0, lineSpacingMultiple: 1.15 });
}

/* 8 — Findings */
{
  const s = P.addSlide(); base(s, "Discovery — the five findings that matter", "08");
  title(s, "Strong core. The real work is around it.");
  const f = [
    ["1 · The core is enterprise-grade", "GiST constraint, derived availability, HITL AI — correct by design. Protect; don't rebuild.", MINT],
    ["2 · Operations is the binding constraint", "Backup/restore, monitoring, fleet onboarding, billing decide whether 25 clients survive — not features.", AMBER],
    ["3 · Compliance needs a workstream", "DPDP rights & retention, Form C artefact, GST invoices, community-list governance.", AMBER],
    ["4 · Two contradictions on paper", "“Self-hosted / locally-owned” vs US-cloud stack · “money owner-only” vs reception recording payments.", RED],
    ["5 · The quiet killer: OTA drift", "Modification emails with no linked update + silent sync failures. Cheap to fix, expensive to ignore.", RED],
  ];
  f.forEach(([h, b, c], i) => {
    const y = 2.15 + i * 0.86;
    s.addShape("roundRect", { x: 0.75, y, w: 11.83, h: 0.76, rectRadius: 0.06, fill: { color: PANEL }, line: { color: LINE, width: 0.5 } });
    s.addText(h, { x: 1.0, y: y + 0.08, w: 4.1, h: 0.6, fontFace: F, fontSize: 12.5, bold: true, color: c, margin: 0, valign: "middle" });
    s.addText(b, { x: 5.2, y: y + 0.08, w: 7.2, h: 0.6, fontFace: F, fontSize: 11, color: INK, margin: 0, valign: "middle" });
  });
}

/* 9 — Gap chart */
{
  const s = P.addSlide(); base(s, "Gap analysis — 30 gaps, prioritized", "09");
  title(s, "Six S1 gaps block safe production. None are features.");
  s.addChart(P.ChartType.bar, [{
    name: "Gaps", labels: ["S1 · production-safety / legal", "S2 · blocks scale or a core objective", "S3 · material quality gap", "S4 · enhancement"],
    values: [6, 13, 10, 1],
  }], {
    x: 0.75, y: 2.2, w: 6.4, h: 3.9, barDir: "bar",
    chartColors: [RED, AMBER, TEAL, "4C6B7D"], chartColorsOpacity: 90,
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: INK, dataLabelFontSize: 12, dataLabelFontFace: F,
    catAxisLabelColor: INK, catAxisLabelFontSize: 11, catAxisLabelFontFace: F,
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
    showLegend: false, showTitle: false, barGapWidthPct: 60,
  });
  card(s, 7.5, 2.2, 5.1, 3.9, "THE S1 SIX",
    "GAP-1  Backup & restore — undocumented, undrilled\nGAP-2  OTA modifications/cancellations — no linked update\nGAP-5  Silent sync/cron failures — no alerts\nGAP-7  Form C — captured but no artefact\nGAP-8  DPDP rights — no export/erase, indefinite retention\nGAP-17 No observability across deployments", RED, 12);
  s.addText("Clusters: production-safety (1/5/17 + 7/8 + 2) → scale (10/18/27/28/12) → money (9/11/13) → experience (3/14/16/4/24). Full table: doc 06.",
    { x: 0.75, y: 6.35, w: 11.8, h: 0.4, fontFace: F, fontSize: 10.5, italic: true, color: MUT, margin: 0 });
}

/* 10 — Compliance */
{
  const s = P.addSlide(); base(s, "Compliance workstream — India-specific, non-optional", "10");
  title(s, "Three legal duties the product must finish, not start.");
  card(s, 0.75, 2.2, 3.85, 3.9, "DPDP ACT 2023",
    "Consent capture exists. Missing: guest data export & erasure, breach runbook, sane ID-scan retention default (today: indefinite until configured), cross-border AI-processing notice.\n\n→ US-202/203/204", AMBER, 12);
  card(s, 4.75, 2.2, 3.85, 3.9, "FORM C (FRRO)",
    "13 foreign-guest fields are captured at check-in — but no artefact, no 24-hour reminder, no submission tracking. Capture without output ≈ non-compliance for the owner.\n\n→ US-201 · Q-LEG-02", AMBER, 12);
  card(s, 8.75, 2.2, 3.85, 3.9, "GST INVOICING",
    "Invoice shows a GSTIN but has no stored invoice entity, no sequential per-FY numbering, no tax lines. Prerequisite: money moves from whole-rupee floats to integer paise.\n\n→ US-205/206 · US-401", AMBER, 12);
  s.addText("Plus the community network's shared bad-guest / scam lists: evidence + appeal + expiry exist — governance policy and counsel review do not (RSK-04).",
    { x: 0.75, y: 6.35, w: 11.8, h: 0.4, fontFace: F, fontSize: 11, italic: true, color: RED, margin: 0 });
}

/* 11 — Fleet/ops */
{
  const s = P.addSlide(); base(s, "Operations workstream — the grant plan's real constraint", "11");
  title(s, "One deployment per client × 25 clients × 3 founders.");
  const rows = [
    ["Backup & restore", "Nightly + offsite + quarterly drills, RTO ≤ 4h — a pilot losing its DB is a region-wide trust kill", RED],
    ["Observability", "Error tracking, uptime, cron health per deployment — today support is blind", RED],
    ["Fleet tooling", "Scripted provisioning (<2h), setup wizard, staged upgrades with backup gates, fleet dashboard", AMBER],
    ["Billing", "Q3 grant milestone is monetisation — today there is no way to invoice a client", AMBER],
    ["Support & training", "SLA, rota, Khasi materials — undefined; churn risk at pilot scale", AMBER],
  ];
  rows.forEach(([h, b, c], i) => {
    const y = 2.2 + i * 0.82;
    s.addShape("roundRect", { x: 0.75, y, w: 11.83, h: 0.72, rectRadius: 0.06, fill: { color: PANEL }, line: { color: LINE, width: 0.5 } });
    s.addShape("roundRect", { x: 1.0, y: y + 0.19, w: 0.34, h: 0.34, rectRadius: 0.05, fill: { color: c } });
    s.addText(h, { x: 1.55, y: y + 0.06, w: 2.7, h: 0.6, fontFace: F, fontSize: 12.5, bold: true, color: INK, margin: 0, valign: "middle" });
    s.addText(b, { x: 4.4, y: y + 0.06, w: 8.0, h: 0.6, fontFace: F, fontSize: 11, color: MUT, margin: 0, valign: "middle" });
  });
}

/* 12 — Risks */
{
  const s = P.addSlide(); base(s, "Top risks — board level", "12");
  title(s, "Five risks worth a founder's attention. 32 in the register.");
  const risks = [
    ["RSK-08", "Data loss with no tested restore", "Low-Med", "Very High", "Backups + quarterly drill (GAP-1)"],
    ["RSK-01/27", "Fleet ops & key-person capacity", "High", "High", "Fleet tooling + hiring per grant jobs plan"],
    ["RSK-04/05", "Community lists + DPDP legal exposure", "Med", "High", "Governance policy + counsel before scale"],
    ["RSK-02", "Grant milestones slip (ops/billing unscoped)", "Med", "High", "Re-baseline roadmap to quarters"],
    ["RSK-13 + GAP-2", "OTA email drift breaks ingestion silently", "High", "Med", "Fixture corpus in CI + linked updates"],
  ];
  const cols = [1.5, 4.3, 1.3, 1.3, 3.4], xs = [0.75];
  cols.forEach((c, i) => xs.push(xs[i] + c));
  ["ID", "Risk", "Prob.", "Impact", "Mitigation"].forEach((h, c) =>
    s.addText(h, { x: xs[c] + 0.1, y: 2.2, w: cols[c] - 0.2, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: MINT, margin: 0 }));
  risks.forEach((r, i) => {
    const y = 2.6 + i * 0.72;
    s.addShape("roundRect", { x: 0.75, y, w: 11.83, h: 0.62, rectRadius: 0.05, fill: { color: i % 2 ? PANEL2 : PANEL }, line: { color: LINE, width: 0.5 } });
    r.forEach((v, c) => s.addText(v, { x: xs[c] + 0.1, y: y + 0.05, w: cols[c] - 0.2, h: 0.52, fontFace: F,
      fontSize: c === 0 ? 10.5 : 10.5, bold: c === 0, color: c === 3 && (v === "Very High" || v === "High") ? RED : INK, margin: 0, valign: "middle" }));
  });
  s.addText("Full register with 32 risks, owners and mitigations: doc 07.", { x: 0.75, y: 6.45, w: 11, h: 0.3, fontFace: F, fontSize: 10.5, italic: true, color: MUT, margin: 0 });
}

/* 13 — Backlog chart */
{
  const s = P.addSlide(); base(s, "The build-out — 50 stories, 9 epics, 198 points", "13");
  title(s, "P0 is three sprints of production-safety. Then commerce, then scale.");
  s.addChart(P.ChartType.bar, [{
    name: "Points", labels: ["E4 Money correctness", "E2 Compliance", "E7 Fleet & onboarding", "E1 Prod safety", "E3 OTA ingestion", "E9 Verification", "E5 Messaging", "E8 Localization", "E6 Auth hardening"],
    values: [40, 32, 28, 26, 26, 22, 21, 21, 18],
  }], {
    x: 0.75, y: 2.15, w: 7.2, h: 4.2, barDir: "bar",
    chartColors: [TEAL], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: INK, dataLabelFontSize: 10.5, dataLabelFontFace: F,
    catAxisLabelColor: INK, catAxisLabelFontSize: 10.5, catAxisLabelFontFace: F,
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
    showLegend: false, showTitle: false, barGapWidthPct: 50,
  });
  stat(s, 8.5, 2.4, "67", "P0 points — gate for scaling\npast the first pilots", RED, 3.9);
  stat(s, 8.5, 3.75, "85", "P1 points — commercial\nactivation (grant Q2/Q3)", AMBER, 3.9);
  stat(s, 8.5, 5.1, "46", "P2 points — scale &\nexperience (grant Q4)", MINT, 3.9);
  s.addText("Workbook: 14-backlog.xlsx (Jira/ADO-ready, live epic-summary formulas).", { x: 0.75, y: 6.55, w: 11, h: 0.3, fontFace: F, fontSize: 10.5, italic: true, color: MUT, margin: 0 });
}

/* 14 — Roadmap */
{
  const s = P.addSlide(); base(s, "Delivery plan — anchored to the grant quarters", "14");
  title(s, "Phase gates, not dates: each phase has exit criteria.");
  const ph = [
    ["PHASE 0 · 2 wks", "Decisions & verification", "Answer the ★ questions · codebase audit converts INFERRED → FACT · re-baseline backlog", MINT],
    ["PHASE 1 · ~3 sprints", "Production safety", "Backups+drills · observability · Form C · DPDP rights · OTA mods · push alerts · resets · paise · P0 tests", RED],
    ["PHASE 2 · ~3 sprints", "Commercial activation", "WhatsApp live · Razorpay · GST invoices · fleet provisioning + wizard + dashboard · pilot billing", AMBER],
    ["PHASE 3 · ~3–4 sprints", "Scale & experience", "Khasi console · two-way messages · sync buffer/frequency · RLS · payout recon · a11y · 25+ clients green", TEAL],
  ];
  ph.forEach(([k, h, b, c], i) => {
    const x = 0.75 + i * 3.02;
    s.addShape("roundRect", { x, y: 2.3, w: 2.85, h: 3.5, rectRadius: 0.07, fill: { color: PANEL }, line: { color: c, width: 1 } });
    s.addText(k, { x: x + 0.2, y: 2.5, w: 2.45, h: 0.28, fontFace: F, fontSize: 10.5, bold: true, color: c, charSpacing: 2, margin: 0 });
    s.addText(h, { x: x + 0.2, y: 2.82, w: 2.45, h: 0.6, fontFace: F, fontSize: 15, bold: true, color: INK, margin: 0 });
    s.addText(b, { x: x + 0.2, y: 3.5, w: 2.45, h: 2.1, fontFace: F, fontSize: 10.5, color: MUT, margin: 0, valign: "top", lineSpacingMultiple: 1.18 });
  });
  s.addText("Grant alignment: Phase 1 ↔ Q2 (10 pilots need safety) · Phase 2 ↔ Q3 (monetisation milestone) · Phase 3 ↔ Q4 (scale-readiness, 25+).",
    { x: 0.75, y: 6.15, w: 11.8, h: 0.35, fontFace: F, fontSize: 11.5, color: INK, margin: 0 });
  s.addText("Governance kept from the repo: plan-first, one PR per slice, CI-gated, safe-migration helper only · added: canary client, pre-migration backup gates, parser fixture corpus.",
    { x: 0.75, y: 6.55, w: 11.8, h: 0.35, fontFace: F, fontSize: 10, italic: true, color: MUT, margin: 0 });
}

/* 15 — Decisions needed */
{
  const s = P.addSlide(); base(s, "What we need from stakeholders", "15");
  title(s, "26 ★ blockers across ~70 questions. The big five:");
  const qs = [
    ["Q-OPS-05", "Fixed room at booking, or book-by-type with assignment at check-in? (touches the DB constraint)"],
    ["Q-FIN-01", "Commission arithmetic: gross vs net-of-GST, MMT net-rate, channel + agent stacking"],
    ["Q-LEG-02 / 03", "Form C artefact that satisfies local FRRO practice · who governs the shared scam/bad-guest registry"],
    ["Q-TEC-04", "What genuinely works offline today — the honest spec for patchy-signal Meghalaya"],
    ["Q-BUS-03", "The monetisation model and price point (grant Q3 milestone)"],
  ];
  qs.forEach(([id, q], i) => {
    const y = 2.2 + i * 0.74;
    s.addShape("roundRect", { x: 0.75, y, w: 11.83, h: 0.64, rectRadius: 0.05, fill: { color: PANEL }, line: { color: LINE, width: 0.5 } });
    s.addText(id, { x: 1.0, y: y + 0.05, w: 1.7, h: 0.54, fontFace: F, fontSize: 11.5, bold: true, color: MINT, margin: 0, valign: "middle" });
    s.addText(q, { x: 2.85, y: y + 0.05, w: 9.5, h: 0.54, fontFace: F, fontSize: 11.5, color: INK, margin: 0, valign: "middle" });
  });
  s.addText([{ text: "Next steps:  ", options: { bold: true, color: MINT } },
    { text: "① owner + reception workshop (3h)   ② MindBit founders workshop (2h)   ③ counsel review (async)   ④ iteration-2 codebase audit   — answers land in the interactive question log and re-baseline the backlog.", options: { color: INK } }],
    { x: 0.75, y: 6.15, w: 11.8, h: 0.8, fontFace: F, fontSize: 12, margin: 0, lineSpacingMultiple: 1.2 });
}

/* 16 — Close */
{
  const s = P.addSlide(); base(s, "", "16");
  s.background = { color: "0A1822" };
  s.addShape("rect", { x: 0, y: 0, w: 0.07, h: H, fill: { color: TEAL } });
  s.addShape("rect", { x: W - 0.07, y: 0, w: 0.07, h: H, fill: { color: "173447" } });
  s.addText("THE DISCOVERY PACKAGE", { x: 0.85, y: 1.1, w: 10, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: MINT, charSpacing: 5, margin: 0 });
  s.addText("Everything a build team needs.\nNothing left to guesswork — except 26 marked questions.",
    { x: 0.82, y: 1.55, w: 11.7, h: 1.7, fontFace: F, fontSize: 34, bold: true, color: "FFFFFF", margin: 0, lineSpacingMultiple: 1.05 });
  const items = [
    ["01–02", "BRD · SRS (md / HTML / Word / PDF)"], ["03–05", "Modules · workflows · ~70 business rules"],
    ["06–08", "30 gaps · 32 risks · 22 ambiguities"], ["09", "Question log (interactive HTML)"],
    ["10–13", "Assumptions · dependencies · data model · APIs"], ["12-A", "ER diagram — 55 entities (HTML / PDF)"],
    ["14–16", "Backlog (.xlsx) · RTM · 100+ test scenarios"], ["17", "Roadmap aligned to grant quarters"],
  ];
  items.forEach(([k, v], i) => {
    const x = 0.85 + (i % 2) * 6.0, y = 3.75 + Math.floor(i / 2) * 0.62;
    s.addText(k, { x, y, w: 0.95, h: 0.5, fontFace: F, fontSize: 12, bold: true, color: MINT, margin: 0 });
    s.addText(v, { x: x + 1.05, y, w: 4.9, h: 0.5, fontFace: F, fontSize: 12, color: "B9D6CD", margin: 0 });
  });
  s.addText([
    { text: "MindBit Solutions LLP", options: { bold: true, color: "FFFFFF" } },
    { text: "   ·   Shillong, Meghalaya   ·   aibor@mindbitsolutions.com   ·   discovery/ in the OTA repo", options: { color: MUT } },
  ], { x: 0.85, y: 6.6, w: 11.8, h: 0.3, fontFace: F, fontSize: 11.5, margin: 0 });
}

P.writeFile({ fileName: OUT }).then(() => console.log("OK deck →", OUT));
