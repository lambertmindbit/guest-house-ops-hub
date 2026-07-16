import type { MessageAdapter, MessageDraft, SendResult } from "@/lib/messaging";

// WhatsApp Cloud API (Meta Graph API) transport for the messaging seam. OFF by
// default: it only activates when WHATSAPP_ENABLED=true AND the access token +
// phone-number id are set. Until then the seam keeps the LogAdapter and nothing is
// sent — so this file is inert on every deployment today.
//
// SCOPE — read before extending. This sends free-form `type:text` messages, which
// Meta delivers only inside the 24-hour customer-service window (i.e. after the
// guest first messages the business number). The app's PROACTIVE messages —
// booking confirmation, pre-arrival, payment reminder — are business-initiated and
// Meta requires them to be pre-approved TEMPLATE messages. Finishing that needs two
// things that don't exist until Meta approves the account:
//   1. the templates approved in Meta's console (names + placeholder order), and
//   2. the seam extended to carry a template name + ordered params — message-
//      templates.ts today renders one body string, not the {{1}},{{2}} params a
//      template send needs.
// This file is the transport the template path will build on; it is deliberately
// not pretending to do the template send yet.

const GRAPH_HOST = "https://graph.facebook.com";

export type WhatsAppConfig = { token: string; phoneNumberId: string; apiVersion: string };

// Config from env, or null if WhatsApp isn't fully switched on. Requires the
// explicit WHATSAPP_ENABLED flag on top of the credentials so a stray env var can
// never start real sends by accident.
export function whatsappConfigFromEnv(env: NodeJS.ProcessEnv = process.env): WhatsAppConfig | null {
  if (env.WHATSAPP_ENABLED !== "true") return null;
  const token = env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId, apiVersion: env.WHATSAPP_API_VERSION?.trim() || "v21.0" };
}

// WhatsApp wants the recipient in international format, digits only, no '+'. Guest
// phones are stored as local 10-digit Indian mobiles, so assume +91 unless a
// country code / '+' / leading 0 is already present.
export function normalizeE164(phone: string, defaultCc = "91"): string {
  const d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.slice(1);
  if (d.startsWith("0")) return defaultCc + d.replace(/^0+/, "");
  if (d.length === 10) return defaultCc + d;
  return d;
}

// The Graph API request body for a free-form text message.
export function buildTextMessage(to: string, body: string): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizeE164(to),
    type: "text",
    text: { preview_url: false, body },
  };
}

export function whatsappAdapter(config: WhatsAppConfig): MessageAdapter {
  return {
    name: "whatsapp-cloud",
    async send(draft: MessageDraft): Promise<SendResult> {
      // Only WhatsApp rides this transport; SMS/email fall back to logged so a
      // mixed-channel future doesn't silently drop those.
      if (draft.channel !== "whatsapp") return { status: "logged" };
      const url = `${GRAPH_HOST}/${config.apiVersion}/${config.phoneNumberId}/messages`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
          body: JSON.stringify(buildTextMessage(draft.to, draft.body)),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          return { status: "failed", error: `WhatsApp ${res.status}: ${detail.slice(0, 300)}` };
        }
        return { status: "sent", sentAt: new Date() };
      } catch (e) {
        return { status: "failed", error: e instanceof Error ? e.message : "send failed" };
      }
    },
  };
}

// The env-selected adapter: WhatsApp when fully configured, else null (the caller
// keeps the LogAdapter). Side-effect-free, so it's safe to call at module load.
export function adapterFromEnv(env: NodeJS.ProcessEnv = process.env): MessageAdapter | null {
  const config = whatsappConfigFromEnv(env);
  return config ? whatsappAdapter(config) : null;
}
