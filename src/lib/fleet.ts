// Fleet tooling (GAP-18): the pure, testable core shared by the onboarding wizard
// (US-702) and the provisioning/upgrade scripts (US-701/703). No I/O here so the
// "is this deployment bookable?" and "what order do we upgrade in?" decisions are
// unit-tested and identical whether a script or the UI asks.

export type SetupCounts = {
  propertyNamed: boolean; // a real name, not the default placeholder
  roomTypes: number;
  rooms: number;
  channels: number;
  staff: number;
};

export type ReadinessStep = {
  key: "property" | "roomTypes" | "rooms" | "channels" | "staff";
  label: string;
  done: boolean;
  required: boolean; // required to reach a bookable state
  hint: string;
  href: string;
};

// A deployment is BOOKABLE once a reservation can actually be created: at least one
// physical room to put a guest in, and at least one channel to attribute it to.
// (Guests are created inline at booking time, so they aren't a prerequisite.)
export function bookableReadiness(c: SetupCounts): { steps: ReadinessStep[]; bookable: boolean; requiredRemaining: number } {
  const steps: ReadinessStep[] = [
    { key: "property", label: "Property details", done: c.propertyNamed, required: true, hint: "Name your guest house (address & GSTIN optional).", href: "/settings/property" },
    { key: "roomTypes", label: "Room types", done: c.roomTypes > 0, required: true, hint: "Add at least one room type with its base rate.", href: "/settings/room-types" },
    { key: "rooms", label: "Rooms", done: c.rooms > 0, required: true, hint: "Add the physical rooms guests can be booked into.", href: "/settings/rooms" },
    { key: "channels", label: "Booking channels", done: c.channels > 0, required: true, hint: "Direct, WhatsApp and the OTAs. Seeded by default.", href: "/settings/channels" },
    { key: "staff", label: "Staff (optional)", done: c.staff > 0, required: false, hint: "Add staff to assign housekeeping and track attendance.", href: "/staff" },
  ];
  const requiredRemaining = steps.filter((s) => s.required && !s.done).length;
  return { steps, bookable: requiredRemaining === 0, requiredRemaining };
}

// ─── Staged fleet upgrade (US-703) ──────────────────────────────────────────

export type FleetClient = { name: string; directUrl: string; canary?: boolean };

// Upgrade order: every canary FIRST, then the rest, each group preserving input
// order. A staged rollout means a bad migration is caught on the canary before it
// can reach the whole fleet — so the canary is never the last thing upgraded.
export function upgradeOrder(clients: FleetClient[]): FleetClient[] {
  const canaries = clients.filter((c) => c.canary);
  const rest = clients.filter((c) => !c.canary);
  return [...canaries, ...rest];
}

export type UpgradeStepResult = { name: string; ok: boolean; error?: string };

// Halt-on-failure: fold results in order and stop reporting "attempted" the moment
// one fails. Pure, so the runner's stop condition is testable without deploying.
export function summariseUpgrade(results: UpgradeStepResult[]): { upgraded: string[]; failedAt: string | null; halted: boolean } {
  const upgraded: string[] = [];
  for (const r of results) {
    if (!r.ok) return { upgraded, failedAt: r.name, halted: true };
    upgraded.push(r.name);
  }
  return { upgraded, failedAt: null, halted: false };
}
