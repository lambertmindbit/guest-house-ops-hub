/**
 * Cloudflare Email Worker — OTA confirmation forwarder for the Guest House Ops Hub.
 *
 * Receives an email (via Cloudflare Email Routing) and POSTs its full raw text to
 * the app's ingestion webhook (POST /api/ingest/email). The app parses it and
 * stages it in the Inbox for review — nothing is ever auto-booked.
 *
 * Fail-safe: if the webhook is unreachable or rejects, the email is forwarded to a
 * fallback mailbox (if configured) so a confirmation is never silently lost; the
 * owner can then paste it into the Inbox manually.
 *
 * Nothing here is hard-coded — plug in three values (no code edits):
 *   - secret  INGEST_TOKEN    must equal INGEST_TOKEN set in Vercel
 *   - var     INGEST_URL      e.g. https://YOUR-APP.vercel.app/api/ingest/email
 *   - var     FALLBACK_EMAIL  (optional) a *verified* Email Routing destination
 *
 * See README.md in this folder for deploy steps.
 */
export default {
  async email(message, env) {
    const url = env.INGEST_URL;
    const token = env.INGEST_TOKEN;

    try {
      if (!url || !token) {
        throw new Error("INGEST_URL / INGEST_TOKEN not configured");
      }

      // The full raw email (headers + body) as plain text — the app's parser
      // greps this, so forwarding it verbatim is correct.
      const raw = await new Response(message.raw).text();

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ingest-token": token,
        },
        body: JSON.stringify({ raw }),
      });

      if (!res.ok) {
        throw new Error(`ingest webhook responded ${res.status}`);
      }
    } catch (err) {
      // Never drop a booking confirmation. Prefer forwarding to a mailbox so the
      // owner can paste it manually; otherwise reject so the failure is visible.
      if (env.FALLBACK_EMAIL) {
        await message.forward(env.FALLBACK_EMAIL);
      } else {
        message.setReject("OTA ingestion failed and no FALLBACK_EMAIL configured");
      }
      console.error("OTA ingest failed:", err && err.message);
    }
  },
};
