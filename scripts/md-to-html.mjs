// Render the project's Markdown docs as styled, easy-to-read HTML.
//
//   npm run docs:html
//
// The .md files stay the source of truth — these .html files are GENERATED and
// should not be hand-edited. Links between the converted docs are rewritten from
// .md to .html so the HTML set is self-navigable. Re-run after editing any doc.
import { marked } from "marked";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The human-facing docs (tooling docs under .claude/ and .planning/ are skipped).
const FILES = [
  "README.md",
  "CLAUDE.md",
  "UI-INVENTORY.md",
  "docs/API.md",
  "docs/ARCHITECTURE.md",
  "docs/CONTRIBUTING.md",
  "docs/DEPLOYMENT.md",
  "docs/DESIGN-HANDOFF.md",
  "docs/ROADMAP.md",
  "docs/SETUP.md",
];
const CONVERTED = new Set(FILES.map((f) => basename(f, ".md")));

marked.setOptions({ gfm: true });

const CSS = `
  :root{--ink:#1c2421;--sub:#5b6b64;--line:#e3e8e5;--paper:#fff;--bg:#f6f8f7;--teal:#0fa68e;--teal-bg:#e7f5f1;--ink-bg:#eef1ef}
  *{box-sizing:border-box}
  body{margin:0;font:15.5px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg);padding:30px 16px}
  .wrap{max-width:860px;margin:0 auto;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:26px 32px}
  .srcnote{font-size:12.5px;color:var(--sub);background:var(--teal-bg);border:1px solid #bfe3da;border-radius:8px;padding:8px 12px;margin:0 0 20px}
  .srcnote a{color:var(--teal)}
  h1{font-size:27px;letter-spacing:-.02em;margin:.2em 0 .5em;border-bottom:2px solid var(--ink);padding-bottom:10px}
  h2{font-size:21px;margin:1.6em 0 .5em;border-bottom:1px solid var(--line);padding-bottom:6px}
  h3{font-size:17px;margin:1.3em 0 .4em}
  h4{font-size:15px;margin:1.2em 0 .3em}
  p{margin:.6em 0}
  a{color:var(--teal)}
  ul,ol{padding-left:24px}
  li{margin:.3em 0}
  code{background:var(--ink-bg);padding:1.5px 6px;border-radius:5px;font-size:13.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  pre{background:#0f1f1a;color:#e2efe9;padding:14px 16px;border-radius:10px;overflow-x:auto;line-height:1.5;margin:14px 0}
  pre code{background:none;padding:0;color:inherit;font-size:13px}
  table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px;display:block;overflow-x:auto}
  th,td{border:1px solid var(--line);padding:8px 12px;text-align:left;vertical-align:top}
  th{background:#eef2f0}
  blockquote{margin:14px 0;padding:10px 16px;border-left:4px solid var(--teal);background:var(--teal-bg);border-radius:0 8px 8px 0;color:#26352f}
  blockquote p{margin:.3em 0}
  hr{border:0;border-top:1px solid var(--line);margin:26px 0}
  img{max-width:100%;border-radius:10px}
`;

function titleFrom(md, file) {
  const m = md.match(/^#\s+(.+)$/m);
  return (m ? m[1] : basename(file)).replace(/[*_`]/g, "").trim();
}

function page(title, body, srcName) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<div class="srcnote">Generated from <code>${srcName}</code> for easy reading — the Markdown file is the source of truth (don't edit this HTML; run <code>npm run docs:html</code>). <a href="../README.html">README</a></div>
${body}
</div>
</body>
</html>
`;
}

let n = 0;
for (const rel of FILES) {
  const md = readFileSync(join(ROOT, rel), "utf8");
  let body = marked.parse(md);
  // Rewrite links to the OTHER converted docs (.md -> .html); leave links to
  // non-converted files (src/*, .planning/*, etc.) untouched.
  body = body.replace(/href="([^"]+?)\.md(#[^"]*)?"/g, (m, path, hash) =>
    CONVERTED.has(path.split("/").pop()) ? `href="${path}.html${hash || ""}"` : m,
  );
  const out = join(ROOT, rel.replace(/\.md$/, ".html"));
  // README/CLAUDE/UI-INVENTORY sit at root, so their "../README.html" note link
  // would 404 — point those at ./README.html instead.
  const html = rel.includes("/")
    ? page(titleFrom(md, rel), body, basename(rel))
    : page(titleFrom(md, rel), body, basename(rel)).replace('href="../README.html"', 'href="README.html"');
  writeFileSync(out, html);
  console.log("  ✓", rel, "→", rel.replace(/\.md$/, ".html"));
  n++;
}
console.log(`\nDone — ${n} HTML docs generated (Markdown left untouched).`);
