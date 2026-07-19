import * as nodeIcal from "node-ical";
import type { IcalFeed } from "@prisma/client";
import { prisma, unscopedPrisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { assertPublicHttpUrl } from "@/lib/url-guard";

export type SyncResult = {
  feedId: string;
  label: string;
  imported: number;
  error?: string;
};

// node-ical parses an all-day VALUE=DATE as local midnight, so read the local
// Y/M/D back out to recover the original calendar date without timezone drift.
function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Fetch + parse one feed and mirror its busy events into `ical` blocks for the
// room. We delete-then-insert this feed's blocks in a transaction so the import
// is idempotent (re-runs don't duplicate) and self-healing (an event removed on
// the OTA disappears here too). Manual blocks and other feeds are untouched.
export async function syncFeed(feed: IcalFeed): Promise<SyncResult> {
  try {
    // Re-validate at fetch time: a feed stored before this guard existed (or one
    // whose host now resolves to a private address) must not be fetched (SSRF).
    await assertPublicHttpUrl(feed.url);
    const data = await nodeIcal.async.fromURL(feed.url);
    const rows = Object.values(data)
      .filter((e): e is nodeIcal.VEvent => (e as { type?: string }).type === "VEVENT")
      .filter((e) => e.start && e.end)
      .map((e) => ({
        roomId: feed.roomId,
        startDate: parseDateOnly(toDateOnly(e.start!)),
        endDate: parseDateOnly(toDateOnly(e.end!)),
        reason: feed.label,
        source: "ical" as const,
        feedId: feed.id,
        externalUid: e.uid ? String(e.uid) : null,
      }))
      .filter((r) => r.endDate > r.startDate);

    await prisma.$transaction(async (tx) => {
      await tx.block.deleteMany({ where: { feedId: feed.id, source: "ical" } });
      if (rows.length > 0) await tx.block.createMany({ data: rows });
    });

    await prisma.icalFeed.update({
      where: { id: feed.id },
      data: { lastSyncedAt: new Date(), lastError: null },
    });
    return { feedId: feed.id, label: feed.label, imported: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await prisma.icalFeed.update({
      where: { id: feed.id },
      data: { lastSyncedAt: new Date(), lastError: message },
    });
    return { feedId: feed.id, label: feed.label, imported: 0, error: message };
  }
}

// Pure (testable): is a feed due for a re-fetch? Never-synced feeds are always
// due; otherwise the last sync must be at least `syncHours` old. GAP-6.
export function feedIsDue(lastSyncedAt: Date | null, syncHours: number, now: Date): boolean {
  if (!lastSyncedAt) return true;
  const ageHours = (now.getTime() - lastSyncedAt.getTime()) / 3_600_000;
  return ageHours >= syncHours;
}

// Sync active feeds. The manual "Sync now" button forces every feed
// (respectFrequency = false, unchanged). The daily cron passes respectFrequency so
// a feed is only re-fetched once its property's icalSyncHours has elapsed — which
// only matters on a host that runs the cron more often than daily.
export async function syncAllFeeds({ respectFrequency = false }: { respectFrequency?: boolean } = {}): Promise<SyncResult[]> {
  const feeds = await prisma.icalFeed.findMany({ where: { active: true } });

  let hoursFor: (propertyId: string | null) => number = () => 24;
  if (respectFrequency) {
    const settings = await unscopedPrisma.propertySettings.findMany({ select: { id: true, icalSyncHours: true } });
    const byId = new Map(settings.map((s) => [s.id, s.icalSyncHours]));
    // Single-property feeds carry a null property_id; fall back to the sole
    // property's setting when there's exactly one, else the daily default.
    const soleHours = settings.length === 1 ? settings[0].icalSyncHours : 24;
    hoursFor = (propertyId) => (propertyId ? byId.get(propertyId) ?? soleHours : soleHours);
  }

  const now = new Date();
  const results: SyncResult[] = [];
  for (const feed of feeds) {
    if (respectFrequency && !feedIsDue(feed.lastSyncedAt, hoursFor(feed.propertyId), now)) continue;
    results.push(await syncFeed(feed));
  }
  return results;
}
