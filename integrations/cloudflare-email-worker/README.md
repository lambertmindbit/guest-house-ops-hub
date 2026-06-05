# OTA Email Ingest — Cloudflare Email Worker

Pre-built, **ready to deploy**. This catches OTA confirmation emails (Booking.com /
Agoda / MakeMyTrip) and POSTs them to the Ops Hub webhook, which stages them in the
**Inbox** for review. Nothing is ever auto-booked.

It's deliberately **isolated from the main app** — its own folder, its own
`package.json`. Deploying it does not touch the Next.js app or its dependencies.

> Activation = fill three values + `wrangler deploy` + point email at it. No code
> edits. The full conceptual walkthrough is in
> [`docs/STATUS.html`](../../docs/STATUS.html) → "A · Automated OTA email ingestion".

---

## What you plug in

| Value | What | Where |
|-------|------|-------|
| `INGEST_TOKEN` | **Secret.** Must equal `INGEST_TOKEN` set in Vercel. | `wrangler secret put INGEST_TOKEN` |
| `INGEST_URL` | Your webhook URL, e.g. `https://YOUR-APP.vercel.app/api/ingest/email` | `wrangler.toml` `[vars]` |
| `FALLBACK_EMAIL` | *(Optional)* A **verified** Email Routing destination. If ingestion fails, the email is forwarded here so it's never lost. | `wrangler.toml` `[vars]` |

## Prerequisites (the external account — can't be pre-built)

1. A domain on **Cloudflare**.
2. **Email → Email Routing** enabled on it (verify the DNS records Cloudflare adds).
3. A Cloudflare API login for `wrangler` (`npx wrangler login`).

## Deploy (one time)

```bash
cd integrations/cloudflare-email-worker
npm install                       # installs wrangler locally (isolated)

# 1. Set the webhook URL (+ optional fallback) in wrangler.toml [vars]
# 2. Set the shared secret (same value as INGEST_TOKEN in Vercel):
npx wrangler secret put INGEST_TOKEN

# 3. Ship it:
npm run deploy
```

## Route email to it

In **Cloudflare → your domain → Email → Email Routing → Routes**:

1. Create an address, e.g. `bookings@yourdomain.com`.
2. Action: **Send to a Worker** → pick `ota-email-ingest`.
3. In the mailbox where OTA confirmations arrive, add a forwarding rule that sends
   those confirmations to `bookings@yourdomain.com`. (Or set the OTA's notification
   email straight to that address.)

## Test

- **Endpoint first** (no email needed) — the `curl` smoke test in
  [`docs/STATUS.html`](../../docs/STATUS.html) confirms the token + webhook.
- **End-to-end** — forward a real confirmation to `bookings@yourdomain.com`; it
  should appear in the app's **Inbox** as *pending*. Watch live logs with:
  ```bash
  npm run tail
  ```

## Local dev (optional)

```bash
cp .dev.vars.example .dev.vars    # fill in token + URL (git-ignored)
npm run dev                       # wrangler dev, with a local email test harness
```

## Notes

- **HTML-only emails:** this forwards the raw email verbatim. The app's parser
  greps plain text, which is fine for typical OTA confirmations. If an OTA sends
  HTML-only mail and fields come out blank, add a small HTML→text strip in
  `src/worker.js` before the `fetch`.
- **Safety:** even fully wired, automation only *fills* the Inbox. The owner still
  does the final review + **Create booking**, so a mis-parse can't corrupt the
  calendar. Retries are de-duplicated by the OTA reference on the app side.
