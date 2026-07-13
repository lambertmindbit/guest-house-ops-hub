// Shared protocol between the assistant runtime and the chat UI. Phase 1 (GenUI
// foundation) is driven by a stub agent (src/lib/assistant/stub.ts); Phase 2
// swaps the stub for the ADK sidecar with no change to these types or the
// renderer. See docs/AGENT-GENUI-PLAN.md.

export type RoomCardData = {
  id: string;
  label: string;
  roomTypeName: string;
  maxOccupancy: number;
  rate: number; // base advisory rate per night (whole rupees)
  free: boolean;
  photos?: string[];
  facing?: string | null;
  view?: string | null;
  amenities?: string[];
};

export type QuoteCardData = {
  roomId: string;
  roomLabel: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: number;
};

export type ConfirmCardData = {
  roomId: string;
  roomLabel: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: number;
  guestName?: string;
  guestPhone?: string;
};

// A demo OTP challenge (Phase 3). Real WhatsApp delivery is the flagged BSP
// follow-up; in demo mode the code is echoed by the agent and typed back here.
export type OtpCardData = {
  note: string;
  demoCode?: string; // shown only in demo mode
};

export type AvailabilityNight = { date: string; total: number; available: number };
export type AvailabilityCardData = {
  roomTypeName: string;
  nights: AvailabilityNight[];
};

// The details form shown after the guest taps Book — collects name + phone
// deterministically (no LLM), then submits to build the confirmation.
export type BookingFormData = {
  roomId: string;
  roomLabel: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
};

// Photos and/or a map link the assistant shows with a FAQ answer.
export type FaqMediaData = { caption?: string; photos?: string[]; mapLink?: string };

// ── Owner-console components ────────────────────────────────────────────────
// The owner agent used to answer purely in prose ("occupancy is 62%…"), so the
// console read like a chat log instead of a dashboard. These let it RENDER its
// answer: headline numbers as tiles, and a comparison as a chart.

export type MetricTile = {
  label: string;
  value: string; // pre-formatted by the agent (₹, %, counts) — the UI never does maths
  context?: string; // small caption under the number
  tone?: "default" | "good" | "warn" | "danger";
};
export type MetricsCardData = { title: string; subtitle?: string; tiles: MetricTile[] };

export type ChartPoint = { label: string; value: number };
export type ChartCardData = {
  title: string;
  subtitle?: string;
  points: ChartPoint[];
  /** Prefixed onto axis/tooltip values, e.g. "₹". */
  valuePrefix?: string;
};

// A generative-UI descriptor the assistant emits; the client renders each via a
// small type→component registry (src/components/assistant/registry.tsx).
export type UIComponent =
  | { type: "rooms"; data: RoomCardData[]; checkIn: string; checkOut: string }
  | { type: "quote"; data: QuoteCardData }
  | { type: "booking_form"; data: BookingFormData }
  | { type: "confirm_booking"; data: ConfirmCardData }
  | { type: "otp"; data: OtpCardData }
  | { type: "faq_media"; data: FaqMediaData }
  | { type: "availability"; data: AvailabilityCardData }
  | { type: "metrics"; data: MetricsCardData }
  | { type: "chart"; data: ChartCardData };

// The streaming wire protocol: the route emits one JSON object per line (NDJSON).
// Phase 1 emits whole text + ui chunks; Phase 2's LLM streams text token-by-token
// through the identical shape.
export type StreamChunk =
  | { type: "text"; delta: string }
  | { type: "ui"; component: UIComponent }
  | { type: "done" }
  | { type: "error"; message: string };

// A turn assembled on the client for rendering.
export type ChatMessage = { role: "user" | "assistant"; text: string; ui: UIComponent[] };
