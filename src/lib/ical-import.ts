import * as nodeIcal from "node-ical";
import type { IcalFeed } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";

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

export async function syncAllFeeds(): Promise<SyncResult[]> {
  const feeds = await prisma.icalFeed.findMany({ where: { active: true } });
  const results: SyncResult[] = [];
  for (const feed of feeds) results.push(await syncFeed(feed));
  return results;
}
