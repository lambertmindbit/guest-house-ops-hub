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
};

export type AvailabilityNight = { date: string; total: number; available: number };
export type AvailabilityCardData = {
  roomTypeName: string;
  nights: AvailabilityNight[];
};

// A generative-UI descriptor the assistant emits; the client renders each via a
// small type→component registry (src/components/assistant/registry.tsx).
export type UIComponent =
  | { type: "rooms"; data: RoomCardData[]; checkIn: string; checkOut: string }
  | { type: "quote"; data: QuoteCardData }
  | { type: "confirm_booking"; data: ConfirmCardData }
  | { type: "availability"; data: AvailabilityCardData };

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
