// Client-safe: pure data + types, NO prisma import — so client components (the
// Settings editor) can import the intent catalog without pulling the server-only
// database client into the browser bundle. The DB functions live in lib/policies.

export const POLICY_INTENTS = [
  {
    intent: "booking",
    label: "Bookings & availability",
    hint: "Guidance when guests ask about rooms, dates, prices, or want to book.",
    placeholder: "e.g. Mention we offer a 5% discount for stays of 3+ nights. Always suggest the Family Suite for groups of 4.",
  },
  {
    intent: "cancellation",
    label: "Cancellations & changes",
    hint: "What the assistant tells guests about cancelling or changing. (It never cancels itself — it always passes the request to you.)",
    placeholder: "e.g. Tell guests free cancellation is available up to 48 hours before check-in; after that one night is charged.",
  },
  {
    intent: "general",
    label: "General guidance & tone",
    hint: "Applies to every conversation — tone, house style, anything guests should always be told.",
    placeholder: "e.g. Be extra warm and mention our free breakfast. We are a quiet, family-run homestay — no loud parties.",
  },
] as const;

export type PolicyIntent = (typeof POLICY_INTENTS)[number]["intent"];

export type PolicyView = {
  id: string;
  intent: string;
  instructions: string;
  active: boolean;
};
