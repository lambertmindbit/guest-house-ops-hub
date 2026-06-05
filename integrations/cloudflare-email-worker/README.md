# OTA Email Ingest — Cloudflare Email Worker

**The "domain" forwarder — best once you run multiple homestays.** Cloudflare
receives mail on your own domain and runs this tiny script on each email, sending
it to the Ops Hub **Inbox** for review (nothing is auto-booked). Free to run.

> Just starting, or only one mailbox? Use the **Gmail** version instead
> (`../gmail-apps-script/`) — no domain, no Cloudflare. You can switch to this
> later with **no app changes** (same webhook, same token).

This folder is **isolated from the main app** — its own `package.json`. Deploying
it does not touch the Next.js app or its dependencies.

---

## Before you begin — read this

Cloudflare Email Routing **takes over your domain's email (MX) records**. So:

- ✅ Use a domain that is **not already running your business email**, **or**
- ⚠️ If you must use a domain that already has email (e.g. Google Workspace on
  `yourhotel.com`), know that enabling Email Routing will redirect that domain's
  mail. Prefer a separate/spare domain for ingestion.

You will plug in **three values** (no code edits):

| Value | What it is | Secret? | Where it goes |
|-------|-----------|---------|---------------|
| `INGEST_TOKEN` | Shared password — **must equal** `INGEST_TOKEN` in Vercel | **Yes** | Worker **Secret** |
| `INGEST_URL` | `https://YOUR-APP.vercel.app/api/ingest/email` | No | `wrangler.toml` `[vars]` (or dashboard Variable) |
| `FALLBACK_EMAIL` | *(optional)* a verified address; failed sends forward here so nothing is lost | No | `wrangler.toml` `[vars]` |

> **Prerequisite:** `INGEST_TOKEN` must already be set in **Vercel** (the app side).
> See `docs/STATUS.html` → "A · Automated OTA email ingestion" → Shared setup.

---

## Part 1 — Get your domain onto Cloudflare

1. **Have a domain.** No domain? Buy one (~$10–15/yr) from any registrar
   (Namecheap, GoDaddy, or Cloudflare Registrar).
2. Create a free account at **https://dash.cloudflare.com**.
3. **Add a site** → type your domain → pick the **Free** plan.
4. Cloudflare gives you **two nameservers**. At your registrar, open the domain's
   **nameserver / DNS** settings and **replace** the existing nameservers with
   Cloudflare's two. Save.
5. Wait until Cloudflare shows the domain as **Active** (minutes to a few hours;
   they email you).

## Part 2 — Enable Email Routing

1. Cloudflare → your domain → **Email → Email Routing** → **Enable** → approve the
   DNS records it adds.
2. Under **Destination addresses**, add your normal email and **verify** it (click
   the link Cloudflare emails you). Use this as `FALLBACK_EMAIL` later.

## Part 3 — Deploy the Worker

### Option A — Terminal (recommended for a developer)

```bash
cd integrations/cloudflare-email-worker
npm install                  # installs wrangler locally (isolated to this folder)
npx wrangler login           # opens a browser to authorise your Cloudflare account
```

1. Edit `wrangler.toml` and set your real URL:
   ```toml
   [vars]
   INGEST_URL = "https://YOUR-APP.vercel.app/api/ingest/email"
   # FALLBACK_EMAIL = "you@example.com"   # optional; must be verified in Part 2
   ```
2. Set the secret (paste the **same** token as in Vercel when prompted):
   ```bash
   npx wrangler secret put INGEST_TOKEN
   ```
3. Deploy:
   ```bash
   npm run deploy
   ```

### Option B — Cloudflare dashboard (no terminal)

1. Cloudflare → **Workers & Pages → Create → Create Worker** → name it
   `ota-email-ingest` → **Deploy** → **Edit code**.
2. Delete the sample, paste the contents of **`src/worker.js`** → **Deploy**.
3. Open the Worker → **Settings → Variables and Secrets** and add:
   - `INGEST_URL` — **Plaintext** — your `…/api/ingest/email` URL
   - `INGEST_TOKEN` — **Secret** (encrypted) — same value as Vercel
   - *(optional)* `FALLBACK_EMAIL` — **Plaintext** — your verified address
4. **Save and deploy.**

## Part 4 — Route emails to the Worker

1. Cloudflare → **Email → Email Routing → Routes → Create address**, e.g.
   `bookings@yourdomain.com`.
2. **Action: Send to a Worker** → choose `ota-email-ingest`.
3. In the mailbox where OTA confirmations arrive, add a **forwarding rule** that
   sends those confirmations to `bookings@yourdomain.com`. (Or set the OTA's
   notification email straight to that address.)

---

## Test

- **Endpoint only** (no email needed) — run the `curl` smoke test from
  `docs/STATUS.html`. Expect `201` and a *Test Guest* in the app's Inbox.
- **End-to-end** — forward a real confirmation to `bookings@yourdomain.com`; it
  should appear in the **Inbox** as *pending*. Watch live logs:
  ```bash
  npm run tail
  ```

## Multiple homestays

One domain can serve several properties. Per property, create:
- a distinct address (e.g. `bookings-seaside@`, `bookings-hilltop@`), and
- its own Worker, each with that property's own `INGEST_URL` + `INGEST_TOKEN`
  (pointing at that property's app deployment).

## Local dev (optional)

```bash
cp .dev.vars.example .dev.vars    # fill in token + URL (this file is git-ignored)
npm run dev                       # wrangler dev, with a local email test harness
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| App Inbox stays empty | Check `npm run tail` logs. Most often a `401` → `INGEST_TOKEN` doesn't match Vercel, or a wrong `INGEST_URL`. |
| `401 unauthorized` | Token mismatch, or `INGEST_TOKEN` not set in Vercel (and not redeployed). |
| `422` | Body wasn't `{ "raw": "..." }` — you edited the Worker; restore the `JSON.stringify({ raw })` call. |
| Your normal email broke | Email Routing took over the domain's MX. Use a separate domain for ingestion. |
| Fields parse blank | Tune `src/lib/email-parse.ts` against real samples (see STATUS.html). |

## Notes

- **HTML-only emails:** the Worker forwards the raw email verbatim. The app's
  parser greps plain text, fine for typical OTA confirmations. If an OTA sends
  HTML-only mail and fields come out blank, add a small HTML→text strip in
  `src/worker.js` before the `fetch`.
- **Safety:** even fully wired, automation only *fills* the Inbox — the owner
  still does the final review + **Create booking**. Retries are de-duplicated by
  the OTA reference on the app side.
