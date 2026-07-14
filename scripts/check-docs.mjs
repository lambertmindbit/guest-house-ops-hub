// Fails the build if the docs have rotted.
//
//   node scripts/check-docs.mjs
//
// Two checks, both of which caught real problems the day this was written:
//
//   1. Broken relative links. Deleting a doc leaves every reference to it
//      dangling, and a name-based grep misses them — when 41 stale docs were
//      removed, a link walker found 5 references that grep did not.
//
//   2. Orphaned links into docs/img/. The screenshots are generated
//      (`npm run shots`); a guide pointing at a PNG that no longer exists just
//      renders a broken image.
//
// Deliberately zero dependencies, so it can run as the first thing in CI.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, normalize } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

// Everything a human reads. Tooling docs under .claude/ are vendored, not ours.
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".claude", ".planning"]);

function markdownFiles(dir = ROOT, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) markdownFiles(join(dir, entry.name), found);
    } else if (entry.name.endsWith(".md")) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

// [text](target) — skipping absolute URLs, anchors and mailto:.
const LINK = /\[[^\]]*\]\((?!https?:|#|mailto:)([^)\s]+)/g;

const problems = [];

for (const file of markdownFiles()) {
  const src = readFileSync(file, "utf8");
  for (const [, raw] of src.matchAll(LINK)) {
    // A link may carry an #anchor or a "title"; only the path matters here.
    const target = raw.split("#")[0].split('"')[0];
    if (!target) continue;

    const resolved = normalize(join(dirname(file), decodeURIComponent(target)));
    if (!existsSync(resolved)) {
      problems.push(`${file.replace(ROOT, "")} → ${target}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} broken doc link(s):\n`);
  for (const p of problems) console.error(`    ${p}`);
  console.error("\n  A deleted doc leaves its references behind. Fix the link or drop it.\n");
  process.exit(1);
}

const count = markdownFiles().length;
console.log(`✓ docs: ${count} Markdown files, no broken links.`);
