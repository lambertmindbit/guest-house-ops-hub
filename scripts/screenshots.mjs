// Auto-generate the user-guide screenshots. No screenshot is ever taken by hand.
//
//   npm run shots                 # against a running app on http://localhost:3100
//   SHOTS_URL=https://… npm run shots
//
// It logs in with OWNER_EMAIL / OWNER_PASSWORD (from .env), visits every screen
// at a phone size (and a few at desktop size), and writes PNGs to docs/img/.
// Re-run any time the UI changes — the guide images stay current automatically.
import "dotenv/config";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "img");
const BASE = process.env.SHOTS_URL || "http://localhost:3100";
const EMAIL = process.env.OWNER_EMAIL;
const PASSWORD = process.env.OWNER_PASSWORD;

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 };

// Mobile route shots: [filename, path, fullPage?]
const ROUTES = [
  ["today", "/"],
  ["calendar", "/calendar"],
  ["new-booking", "/reservations/new"],
  ["guests", "/guests"],
  ["housekeeping", "/housekeeping"],
  ["inbox", "/inbox"],
  ["pricing", "/pricing"],
  ["finance", "/finance"],
  ["analytics", "/analytics"],
  ["conflicts", "/conflicts"],
  ["feeds", "/feeds"],
  ["settings-rooms", "/settings/rooms"],
  ["settings-pricing", "/settings/pricing"],
  ["block-room", "/settings/blocks"],
  ["help", "/help"],
];

let ok = 0, fail = 0;
async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
}
async function shot(page, name, opts = {}) {
  try {
    await settle(page);
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: !!opts.fullPage });
    console.log("  ✓", name);
    ok++;
  } catch (e) {
    console.log("  ✗", name, "—", e.message.split("\n")[0]);
    fail++;
  }
}
async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !location.pathname.includes("login"), { timeout: 30000 });
}

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error("OWNER_EMAIL / OWNER_PASSWORD not set (.env)");
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // ---------- MOBILE ----------
  const m = await browser.newContext(PHONE);
  const mp = await m.newPage();

  // login screen (before auth)
  await mp.goto(`${BASE}/login`, { waitUntil: "load" });
  await shot(mp, "login");

  await login(mp);

  // a real reservation id for the detail/invoice/payments shots
  let resId = null;
  try {
    const r = await m.request.get(`${BASE}/api/reservations`);
    resId = (await r.json())?.data?.[0]?.id ?? null;
  } catch {}

  for (const [name, path] of ROUTES) {
    await mp.goto(`${BASE}${path}`, { waitUntil: "load" });
    await shot(mp, name);
  }

  if (resId) {
    await mp.goto(`${BASE}/reservations/${resId}`, { waitUntil: "load" });
    await shot(mp, "reservation-detail");
    await shot(mp, "payments", { fullPage: true });
    await mp.goto(`${BASE}/reservations/${resId}/invoice`, { waitUntil: "load" });
    await shot(mp, "invoice", { fullPage: true });
  }

  // nav: bottom tab bar (element close-up)
  try {
    await mp.goto(`${BASE}/`, { waitUntil: "load" });
    await settle(mp);
    await mp.locator(".tabbar").screenshot({ path: join(OUT, "nav-tabbar.png") });
    console.log("  ✓", "nav-tabbar"); ok++;
  } catch (e) { console.log("  ✗ nav-tabbar —", e.message.split("\n")[0]); fail++; }

  // More sheet
  try {
    await mp.goto(`${BASE}/`, { waitUntil: "load" });
    await settle(mp);
    await mp.click('button.tab:has-text("More")');
    await mp.waitForSelector(".sheet", { timeout: 5000 });
    await mp.waitForTimeout(400);
    await shot(mp, "more-sheet");
    // Preferences (opened from the sheet)
    await mp.click('.sheet__row:has-text("Preferences")');
    await mp.waitForSelector(".prefs", { timeout: 5000 });
    await mp.waitForTimeout(400);
    await shot(mp, "preferences");
  } catch (e) { console.log("  ✗ more-sheet/preferences —", e.message.split("\n")[0]); fail++; }

  // Dark mode (do last — flips the theme)
  try {
    await mp.goto(`${BASE}/`, { waitUntil: "load" });
    await mp.evaluate(() => localStorage.setItem("ops-appearance", "dark"));
    await mp.reload({ waitUntil: "load" });
    await shot(mp, "dark-mode");
  } catch (e) { console.log("  ✗ dark-mode —", e.message.split("\n")[0]); fail++; }

  await m.close();

  // ---------- DESKTOP ----------
  const d = await browser.newContext(DESKTOP);
  const dp = await d.newPage();
  await login(dp);
  await dp.goto(`${BASE}/`, { waitUntil: "load" });
  await shot(dp, "desktop-sidebar");
  await dp.goto(`${BASE}/calendar`, { waitUntil: "load" });
  await shot(dp, "desktop-calendar");
  await d.close();

  await browser.close();
  console.log(`\nDone → docs/img/  (${ok} ok, ${fail} failed)`);
  if (fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
