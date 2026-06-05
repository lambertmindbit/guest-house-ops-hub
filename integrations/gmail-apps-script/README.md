# OTA Email Ingest — Gmail (Google Apps Script)

The **no-domain, no-Cloudflare** forwarder. It runs inside your own Google account
on a 5-minute timer: it finds OTA confirmation emails you've labelled, sends each
to the Ops Hub webhook (which stages them in the **Inbox** for review — never
auto-booked), then marks them done so they're never sent twice.

> This replaces the Cloudflare Worker. You still set `INGEST_TOKEN` in **Vercel**
> (that part is the same); this just delivers the emails instead of Cloudflare.

---

## What you need
- A **Gmail account** where OTA confirmations arrive (or get forwarded). That's it.
- `INGEST_TOKEN` already set in Vercel (see `docs/STATUS.html` → "A · …", Part 1).

## Step 1 — Label the OTA emails in Gmail
Make a filter so confirmations get tagged automatically:
1. Gmail → search box → **Show search options** (the sliders icon).
2. In **From**, enter: `booking.com OR agoda.com OR makemytrip.com` (adjust to the
   senders you actually get).
3. **Create filter** → tick **Apply the label** → **New label…** → name it
   exactly **`OTA-Ingest`** → **Create filter**.
   *(Optional: also tick "Also apply to matching conversations" to catch existing ones.)*

## Step 2 — Create the script
1. Go to **[script.google.com](https://script.google.com)** → **New project**.
2. Delete the sample code, paste the contents of **`Code.gs`** from this folder.
3. Rename the project (top-left) to something like *OTA Ingest*.

## Step 3 — Plug in your values (the "environment variables")
In the script editor: **Project Settings** (the ⚙ gear) → scroll to **Script
properties** → **Add script property**, and add:

| Property | Value |
|----------|-------|
| `INGEST_URL` | `https://YOUR-APP.vercel.app/api/ingest/email` |
| `INGEST_TOKEN` | the **same** value you set in Vercel |

(Optional: `LABEL_TODO` / `LABEL_DONE` if you want label names other than the
defaults `OTA-Ingest` / `OTA-Ingested`.)

## Step 4 — Test it
1. In the editor, pick **`testConnection`** in the function dropdown → **Run**.
2. The first run asks you to **authorise** — approve the Gmail + external-request
   permissions (it's your own script).
3. Open **Execution log** — you should see **`201`** and an `id`. Check the app's
   **Inbox**: a *Test Guest* item should be waiting. ✅
   *(A `401` means the token doesn't match Vercel; a `422` means the URL is wrong.)*

## Step 5 — Turn on the timer
Pick **`setup`** in the function dropdown → **Run**. That installs a trigger that
runs every 5 minutes. Done — labelled emails now flow into the Inbox on their own.

---

## How it works / good to know
- **Safe:** automation only *fills* the Inbox. You still review + **Create booking**,
  so a mis-parsed email can't corrupt the calendar.
- **No duplicates:** after a successful send the thread is re-labelled `OTA-Ingested`;
  the app also de-dupes by the OTA reference.
- **Retries:** if the webhook is briefly down, the email keeps its `OTA-Ingest`
  label and is retried on the next 5-minute run.
- **Free:** well within Gmail/Apps Script free quotas for a small property.
- **To pause it:** in the script editor → **Triggers** (clock icon) → delete the
  trigger. To resume, run `setup` again.
- **Moving to a domain later?** Switch to the Cloudflare Worker in
  `../cloudflare-email-worker/` — same webhook, same token, nothing app-side changes.
