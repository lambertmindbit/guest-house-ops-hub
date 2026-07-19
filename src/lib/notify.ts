import { sendOwnerPush, type PushPayload } from "@/lib/push";
import { unscopedPrisma } from "@/lib/prisma";
import { countConflicts } from "@/lib/conflicts";
import type { SyncResult } from "@/lib/ical-import";

// Owner web-push, per-event and toggle-aware (GAP-14). Best-effort throughout: a
// push must never break the flow that triggered it (filing an escalation, running
// the sync cron). Reads the sole property's toggles — single-property today;
// escalations don't yet carry a property, so multi-property push scoping is a
// known limitation, consistent with sendOwnerPush's own sole-property fallback.

export type PushEvent = "escalation" | "conflict" | "staleSync";
type Toggles = { pushEscalations: boolean; pushConflicts: boolean; pushStaleSync: boolean };
const TOGGLE: Record<PushEvent, keyof Toggles> = {
  escalation: "pushEscalations",
  conflict: "pushConflicts",
  staleSync: "pushStaleSync",
};

// Pure (testable): is this event enabled? Default ON — only an explicit `false`
// mutes it, and no settings row (fresh install) means everything is on.
export function eventEnabled(settings: Partial<Toggles> | null, event: PushEvent): boolean {
  return !settings || settings[TOGGLE[event]] !== false;
}

export async function notifyOwner(event: PushEvent, payload: PushPayload): Promise<void> {
  try {
    const settings = await unscopedPrisma.propertySettings.findFirst({
      select: { pushEscalations: true, pushConflicts: true, pushStaleSync: true },
    });
    if (!eventEnabled(settings, event)) return;
    await sendOwnerPush(payload);
  } catch {
    // notifications are best-effort
  }
}

// After a BACKGROUND sync run: push when new conflicts appeared (delta vs before
// the sync — so it only fires when the sync makes things worse, never on a steady
// state) or when a feed failed to sync (stale availability).
export async function notifyAfterSync(conflictsBefore: number, results: SyncResult[]): Promise<void> {
  const after = await countConflicts().catch(() => conflictsBefore);
  if (after > conflictsBefore) {
    await notifyOwner("conflict", {
      title: "New booking conflict",
      body: `${after} conflict${after === 1 ? "" : "s"} need your attention.`,
      url: "/needs-you",
      tag: "conflicts",
    });
  }
  const failed = results.filter((r) => r.error).length;
  if (failed > 0) {
    await notifyOwner("staleSync", {
      title: "iCal sync failing",
      body: `${failed} feed${failed === 1 ? "" : "s"} failed to sync — availability may be out of date.`,
      url: "/settings/feeds",
      tag: "stale-sync",
    });
  }
}
