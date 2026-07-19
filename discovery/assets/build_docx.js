/* md → styled .docx for the discovery document family (BRD, SRS).
   Usage: node build_docx.js <basename>   e.g. node build_docx.js 01-BRD */
const fs = require("fs"), path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, AlignmentType, HeadingLevel, Footer, Header,
  PageNumber, TableOfContents, LevelFormat, PageBreak, VerticalAlign,
} = require("docx");

const ROOT = path.resolve(__dirname, "..");
const BASE = process.argv[2];
const META = {
  "01-BRD": {
    title: "Business Requirements Document",
    code: "BRD-GHOH-001", num: "01",
    subtitle: "Guest House Operations Hub — ROOT Platform PMS Layer",
    desc: "Business context, objectives, stakeholders, current & future state, business processes, scope, risks, assumptions and success metrics for the Guest House Operations Hub.",
  },
  "02-SRS": {
    title: "Software Requirements Specification",
    code: "SRS-GHOH-001", num: "02",
    subtitle: "Guest House Operations Hub — ROOT Platform PMS Layer",
    desc: "Functional and non-functional requirements with build status, binding constraints, external interfaces, data model, error handling, security, performance and observability. Structured per IEEE 29148/830 principles.",
  },
}[BASE];
if (!META) { console.error("unknown doc " + BASE); process.exit(1); }

const NAVY = "12303F", NAVY2 = "1C4356", TEAL = "0FA68E", TEALDK = "0B7D6B",
      SUB = "5B6B64", LINE = "D9E2DE", TEALBG = "E7F5F1", AMBER = "A8690A",
      RED = "B3362B", BLUEREC = "2A4D8F";

let md = fs.readFileSync(path.join(ROOT, BASE + ".md"), "utf8");
// strip backticks wrapping evidence tags (they garble inline parsing)
md = md.replace(/`(\[(?:FACT|INFERRED|REC|OPEN-Q)[^\]]*\])`/g, "$1");
// drop the md preamble (title + metadata table already on the cover): cut to the first hr
const hr = md.indexOf("\n---");
if (hr > 0) md = md.slice(hr + 4);

/* ---------- inline md → TextRuns ---------- */
function inline(text, base = {}) {
  const runs = [];
  // tag tokens first
  const tagRe = /\[(FACT|INFERRED|REC|OPEN-Q)[^\]]*\]/g;
  const tokens = [];
  let last = 0, m;
  while ((m = tagRe.exec(text))) {
    if (m.index > last) tokens.push({ t: "txt", v: text.slice(last, m.index) });
    tokens.push({ t: "tag", v: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ t: "txt", v: text.slice(last) });
  const tagColor = { FACT: TEALDK, INFERRED: AMBER, REC: BLUEREC, "OPEN-Q": RED };
  for (const tok of tokens) {
    if (tok.t === "tag") {
      runs.push(new TextRun({ text: " " + tok.v + " ", bold: true, size: 14,
        color: tagColor[tok.v], font: "Consolas", ...base }));
      continue;
    }
    // strip links → text, images → alt
    let s = tok.v.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
                 .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    // split by ** bold, ` code, * italic (simple non-nested)
    const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_]+_)/g;
    let l2 = 0, mm;
    while ((mm = re.exec(s))) {
      if (mm.index > l2) runs.push(new TextRun({ text: s.slice(l2, mm.index), ...base }));
      const w = mm[0];
      if (w.startsWith("**")) runs.push(new TextRun({ text: w.slice(2, -2), bold: true, color: NAVY, ...base }));
      else if (w.startsWith("`")) runs.push(new TextRun({ text: w.slice(1, -1), font: "Consolas", size: 17, color: "20443A", shading: { type: ShadingType.CLEAR, fill: "EEF2F0" }, ...base }));
      else runs.push(new TextRun({ text: w.replace(/^[*_]|[*_]$/g, ""), italics: true, ...base }));
      l2 = mm.index + w.length;
    }
    if (l2 < s.length) runs.push(new TextRun({ text: s.slice(l2), ...base }));
  }
  return runs.length ? runs : [new TextRun({ text: "", ...base })];
}

/* ---------- block parser ---------- */
const lines = md.split("\n");
const children = [];
const noBorder = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const cellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function addTable(rows) {
  const ncol = rows[0].length;
  const total = 9360; // usable width dxa
  const widths = Array(ncol).fill(Math.floor(total / ncol));
  // widen 2nd column for 2-col tables, or content-ish heuristics
  if (ncol === 2) { widths[0] = 2200; widths[1] = total - 2200; }
  const trs = rows.map((cells, ri) =>
    new TableRow({
      tableHeader: ri === 0,
      children: cells.map((c, ci) =>
        new TableCell({
          width: { size: widths[ci], type: WidthType.DXA },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          shading: ri === 0 ? { type: ShadingType.CLEAR, fill: NAVY }
                 : ri % 2 === 0 ? { type: ShadingType.CLEAR, fill: "F6FAF8" } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({
            spacing: { before: 0, after: 0 },
            children: inline(c, ri === 0
              ? { bold: true, color: "FFFFFF", size: 17 }
              : { size: 18 }),
          })],
        })),
    }));
  children.push(new Table({ columnWidths: widths, width: { size: total, type: WidthType.DXA }, rows: trs }));
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
}

let i = 0, skippedTitle = false;
while (i < lines.length) {
  let line = lines[i];

  if (/^\s*$/.test(line)) { i++; continue; }
  if (/^---+$/.test(line.trim())) { i++; continue; }

  // code fence
  if (line.startsWith("```")) {
    const lang = line.slice(3).trim(); i++;
    const buf = [];
    while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
    i++;
    if (lang === "mermaid") {
      children.push(new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: TEALBG },
        border: { left: { style: BorderStyle.SINGLE, size: 24, color: TEAL } },
        spacing: { before: 120, after: 60 },
        children: [new TextRun({ text: "Diagram (rendered in the HTML edition " + BASE + ".html; Mermaid source below).", italics: true, color: SUB, size: 17 })],
      }));
    }
    for (const b of buf) children.push(new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: "F2F5F4" },
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: b || " ", font: "Consolas", size: 14, color: "33453E" })],
    }));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    continue;
  }

  // table
  if (line.trim().startsWith("|")) {
    const rows = [];
    while (i < lines.length && lines[i].trim().startsWith("|")) {
      const raw = lines[i].trim().replace(/^\||\|$/g, "");
      if (!/^[\s:\-|]+$/.test(raw)) rows.push(raw.split("|").map(s => s.trim()));
      i++;
    }
    if (rows.length) addTable(rows);
    continue;
  }

  // headings
  const h = line.match(/^(#{1,4})\s+(.*)/);
  if (h) {
    const lvl = h[1].length; const txt = h[2].replace(/\*\*/g, "");
    if (lvl === 1 && !skippedTitle) { skippedTitle = true; i++; continue; } // title on cover
    if (lvl === 2 && /^\d\./.test(txt) === false && txt.length < 4) { i++; continue; }
    const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_1, 3: HeadingLevel.HEADING_2, 4: HeadingLevel.HEADING_3 };
    children.push(new Paragraph({ heading: map[lvl], children: inline(txt) }));
    i++; continue;
  }

  // blockquote
  if (line.startsWith(">")) {
    const buf = [];
    while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^>\s?/, ""));
    children.push(new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: TEALBG },
      border: { left: { style: BorderStyle.SINGLE, size: 24, color: TEAL } },
      spacing: { before: 120, after: 120 },
      children: inline(buf.join(" ")),
    }));
    continue;
  }

  // lists
  const bullet = line.match(/^(\s*)[-*]\s+(.*)/);
  const numd  = line.match(/^(\s*)\d+\.\s+(.*)/);
  if (bullet || numd) {
    const m2 = bullet || numd;
    const level = Math.min(Math.floor(m2[1].length / 2), 2);
    children.push(new Paragraph({
      numbering: { reference: bullet ? "bul" : "num", level },
      spacing: { after: 40 },
      children: inline(m2[2]),
    }));
    i++; continue;
  }

  // paragraph (merge soft-wrapped lines)
  const buf = [line];
  i++;
  while (i < lines.length && lines[i].trim() && !/^([#>|`]|[-*]\s|\d+\.\s|```|---)/.test(lines[i].trim())) buf.push(lines[i++]);
  children.push(new Paragraph({ spacing: { after: 100 }, children: inline(buf.join(" ")) }));
}

/* ---------- cover ---------- */
const coverMeta = [
  ["Document", `${META.code} · ${META.title}`],
  ["Version", "1.0 — Discovery Pass 1 (pre-codebase-audit)"],
  ["Date", "16 July 2026"],
  ["Prepared by", "MindBit Solutions LLP — discovery analysis"],
  ["System", "Guest House Operations Hub · ROOT Platform"],
  ["Locale", "INR · IST · India (GST / DPDP Act jurisdiction)"],
  ["Companion files", `${BASE}.md (source of record) · ${BASE}.html (styled, live diagrams) · full discovery package docs 01–17`],
  ["Status", "DRAFT — pending stakeholder answers to the Question Log (doc 09)"],
];
const cover = [
  new Paragraph({ spacing: { before: 500 }, children: [new TextRun({ text: "MINDBIT SOLUTIONS LLP · ROOT PLATFORM · CONFIDENTIAL", color: TEALDK, bold: true, size: 15, characterSpacing: 30 })] }),
  new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: META.title, bold: true, size: 56, color: NAVY })] }),
  new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: META.subtitle, size: 28, color: NAVY2 })] }),
  new Paragraph({
    spacing: { before: 160, after: 280 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: TEAL } },
    shading: { type: ShadingType.CLEAR, fill: TEALBG },
    children: [new TextRun({ text: META.desc, size: 21, color: "26352F" })],
  }),
  new Table({
    columnWidths: [2200, 7160], width: { size: 9360, type: WidthType.DXA },
    rows: coverMeta.map(([k, v]) => new TableRow({
      children: [
        new TableCell({ width: { size: 2200, type: WidthType.DXA }, borders: cellBorders, shading: { type: ShadingType.CLEAR, fill: NAVY }, margins: { top: 70, bottom: 70, left: 110, right: 110 }, children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 7160, type: WidthType.DXA }, borders: cellBorders, margins: { top: 70, bottom: 70, left: 110, right: 110 }, children: [new Paragraph({ children: [new TextRun({ text: v, size: 18 })] })] }),
      ],
    })),
  }),
  new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "Evidence convention used throughout:  ", size: 18, color: SUB }),
    new TextRun({ text: "FACT", bold: true, color: TEALDK, size: 18 }), new TextRun({ text: " stated in an authoritative source · ", size: 18, color: SUB }),
    new TextRun({ text: "INFERRED", bold: true, color: AMBER, size: 18 }), new TextRun({ text: " needs confirmation · ", size: 18, color: SUB }),
    new TextRun({ text: "REC", bold: true, color: BLUEREC, size: 18 }), new TextRun({ text: " analyst recommendation · ", size: 18, color: SUB }),
    new TextRun({ text: "OPEN-Q", bold: true, color: RED, size: 18 }), new TextRun({ text: " stakeholder decision required (doc 09).", size: 18, color: SUB })] }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Contents")] }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({ children: [new TextRun({ text: "In Word: right-click the table of contents → Update Field. Page numbers populate on update.", italics: true, size: 16, color: SUB })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

const doc = new Document({
  numbering: {
    config: [
      { reference: "bul", levels: [0, 1, 2].map(l => ({ level: l, format: LevelFormat.BULLET, text: ["•", "◦", "▪"][l], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 + 360 * l, hanging: 200 } } } })) },
      { reference: "num", levels: [0, 1, 2].map(l => ({ level: l, format: LevelFormat.DECIMAL, text: "%" + (l + 1) + ".", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 + 360 * l, hanging: 260 } } } })) },
    ],
  },
  styles: {
    default: { document: { run: { font: "Calibri", size: 20, color: "1C2421" }, paragraph: { spacing: { line: 264 } } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Calibri", size: 30, bold: true, color: NAVY },
        paragraph: { spacing: { before: 320, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY } }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Calibri", size: 24, bold: true, color: NAVY2 },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Calibri", size: 21, bold: true, color: TEALDK },
        paragraph: { spacing: { before: 180, after: 60 }, outlineLevel: 2 } },
    ],
  },
  features: { updateFields: true },
  sections: [{
    properties: { page: { margin: { top: 1100, bottom: 1000, left: 1250, right: 1250 } } },
    headers: { default: new Header({ children: [new Paragraph({
      tabStops: [{ type: "right", position: 9360 }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE } },
      children: [
        new TextRun({ text: `${META.code} — ${META.title}`, size: 15, color: SUB }),
        new TextRun({ text: "\tMindBit Solutions LLP · Confidential", size: 15, color: SUB }),
      ] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({
      tabStops: [{ type: "right", position: 9360 }],
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: LINE } },
      children: [
        new TextRun({ text: "© 2026 MindBit Solutions LLP · Shillong, Meghalaya", size: 15, color: SUB }),
        new TextRun({ text: "\tPage ", size: 15, color: SUB }),
        new TextRun({ size: 15, color: SUB, children: [PageNumber.CURRENT] }),
        new TextRun({ text: " of ", size: 15, color: SUB }),
        new TextRun({ size: 15, color: SUB, children: [PageNumber.TOTAL_PAGES] }),
      ] })] }) },
    children: [...cover, ...children],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(path.join(ROOT, BASE + ".docx"), buf);
  console.log("OK", BASE + ".docx", buf.length);
});
