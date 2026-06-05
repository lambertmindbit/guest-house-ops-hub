# OTA Email Ingest — Gmail (Google Apps Script)

**The no-domain forwarder — start here.** A small free script runs inside your own
Google account on a 5-minute timer: it finds OTA confirmation emails you've
labelled, sends each to the Ops Hub **Inbox** for review (never auto-booked), then
marks them done so they're never sent twice.

> No Cloudflare, no domain, no DNS. Moving to multiple homestays later? Switch to
> the Cloudflare Worker in `../cloudflare-email-worker/` — same webhook, same
> token, nothing app-side changes.

---

## What you need
- A **Gmail account** where OTA confirmations arrive (or get forwarded to).
- **`INGEST_TOKEN` already set in Vercel** (the app side). See `docs/STATUS.html`
  → "A · Automated OTA email ingestion" → Shared setup. Keep that token string
  handy — you paste the same one below.

You will plug in two values as **Script properties** (Apps Script's version of
environment variables):

| Property | Value |
|----------|-------|
| `INGEST_URL` | `https://YOUR-APP.vercel.app/api/ingest/email` |
| `INGEST_TOKEN` | the **same** value as `INGEST_TOKEN` in Vercel |
| `LABEL_TODO` *(optional)* | label your filter applies (default `OTA-Ingest`) |
| `LABEL_DONE` *(optional)* | label applied after sending (default `OTA-Ingested`) |

---

## Step 1 — Tag the OTA emails in Gmail

So the script knows which emails to send, give them a label automatically:

1. In Gmail, click the **filter/sliders icon** inside the search bar (top of the page).
2. In the **From** field, enter the OTA senders you receive, separated by `OR`:
   ```
   booking.com OR agoda.com OR makemytrip.com
   ```
3. Click **Create filter** (bottom-right of the options box).
4. Tick **Apply the label** → **Choose label… → New label…** → name it exactly
   **`OTA-Ingest`** → **Create**.
5. *(Recommended)* also tick **Also apply to matching conversations** so emails
   already in your inbox get labelled too.
6. Click **Create filter**.

## Step 2 — Create the script

1. Go to **https://script.google.com** → **New project**.
2. Select all the sample code in `Code.gs` and delete it.
3. Open **`integrations/gmail-apps-script/Code.gs`** from this project, copy
   **everything**, and paste it into the editor.
4. Rename the project (click *Untitled project*, top-left) to e.g. **OTA Ingest**.
5. Click **Save** (💾).

## Step 3 — Plug in your two values

1. Click **Project Settings** (the ⚙ gear icon, left sidebar).
2. Scroll to **Script properties** → **Add script property**.
3. Add the first: property `INGEST_URL`, value
   `https://YOUR-APP.vercel.app/api/ingest/email`.
4. **Add script property** again: `INGEST_TOKEN` = the **same** token string you
   set in Vercel.
5. Click **Save script properties**.

## Step 4 — Test it

1. Go back to the **editor** (the `< >` icon).
2. In the function dropdown at the top, choose **`testConnection`** → click **Run**.
3. The first run asks you to **authorise** — click through and **Allow** the Gmail
   + external-request permissions. *(Google may warn it's an unverified app
   because it's your own script — choose **Advanced → Go to … (unsafe)** → Allow.)*
4. Open the **Execution log** at the bottom. You should see **`201`** and an `id`.
5. Open the app's **Inbox** screen — a **Test Guest** booking is waiting. ✅

If you see `401`, the token doesn't match Vercel. If `422`, the `INGEST_URL` is wrong.

## Step 5 — Switch on the timer

1. In the function dropdown, choose **`setup`** → **Run**.
2. This installs a trigger that runs **every 5 minutes**.
3. **Done.** Labelled OTA emails now flow into the Inbox automatically.

---

## Everyday use & control

- **Pause it:** editor → **Triggers** (the ⏰ clock icon, left sidebar) → delete the
  trigger. **Resume:** run `setup` again.
- **See what it's doing:** editor → **Executions** (the ▶ list icon) shows each run.
- **It won't double-send:** after a successful send the email is re-labelled
  `OTA-Ingested`; the app also de-dupes by the OTA reference.
- **If the app is briefly down:** the email keeps its `OTA-Ingest` label and is
  retried on the next 5-minute run.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Set INGEST_URL and INGEST_TOKEN…` error | You skipped Step 3, or a typo in the property name. They are case-sensitive. |
| Log shows `401` | `INGEST_TOKEN` here ≠ the one in Vercel, or Vercel wasn't redeployed after setting it. |
| Log shows `422` | `INGEST_URL` is wrong — it must end in `/api/ingest/email`. |
| Nothing gets sent | No emails carry the `OTA-Ingest` label yet — check your Step 1 filter, or apply the label manually to one email to test. |
| Fields come in blank in the Inbox | Normal for now — tune `src/lib/email-parse.ts` against real samples (see STATUS.html). The review screen lets you fix any field before creating the booking. |

## Notes

- **Free:** comfortably within Gmail/Apps Script free quotas for a small property.
- **Safety:** automation only *fills* the Inbox. You always do the final review +
  **Create booking**, so a mis-parsed email can't corrupt the calendar.
- **Privacy:** the script runs only in your own Google account and talks only to
  your app's webhook.
