// Calls one of the app's cron endpoints with the shared secret.
//
// Vercel Cron signs the request to your own app for you; most other platforms
// (DigitalOcean App Platform scheduled jobs, a plain crontab, GitHub Actions)
// don't, so they need something to make the call. This is that something.
//
//   APP_URL=https://… CRON_SECRET=… node scripts/cron-ping.mjs sync
//
// Deliberately uses nothing but the Node standard library, so a scheduled job
// running it needs no dependencies installed and no build step.

const ROUTES = ["sync", "messaging", "purge-ids"];

// The iCal sync walks every configured feed, so it can legitimately take
// minutes. Long, but not forever — a hung job must eventually fail, not hold a
// scheduled slot open indefinitely.
const TIMEOUT_MS = 10 * 60 * 1000;

function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const route = process.argv[2];
if (!ROUTES.includes(route)) {
  die(`Usage: node scripts/cron-ping.mjs <${ROUTES.join(" | ")}>`);
}

const base = process.env.APP_URL;
const secret = process.env.CRON_SECRET;
if (!base) die("APP_URL is not set — it must be the app's public base URL.");
if (!secret) die("CRON_SECRET is not set — it must match the app's CRON_SECRET.");

const url = new URL(`/api/cron/${route}`, base);
console.log(`▸ ${route} → ${url.href}`);

let res;
try {
  res = await fetch(url, {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
} catch (e) {
  die(`${route} could not be reached: ${e.message}`);
}

const body = (await res.text()).slice(0, 1000);

// Exit non-zero on any non-2xx so the platform records a FAILED job. A cron that
// 401s every night while reporting success is worse than one that never ran.
if (!res.ok) {
  die(`${route} → ${res.status} ${res.statusText}\n${body}`);
}

console.log(`✓ ${route} → ${res.status}\n${body}`);
