import { prisma } from "@/lib/prisma";
import { currentPropertySettings } from "@/lib/property-settings";
import { todayDateOnly, parseDateOnly, formatDateOnly } from "@/lib/dates";

export type HousekeepingRoom = {
  id: string;
  label: string;
  roomTypeName: string;
  needsCleaning: boolean;
  awaitingInspection: boolean;
  lastDeparture: string | null;
  arrivalToday: boolean;
  occupiedTonight: boolean;
  highPriority: boolean;
};

// Pure derivation of a room's cleaning state (GAP-20), so availability-style
// correctness lives in one testable place. A room needs cleaning when a guest
// departed since it was last cleaned, or it's manually flagged. When the property
// requires inspection, a cleaned-but-not-yet-inspected room is "awaiting
// inspection" — not yet ready. Inspection off (default) → awaiting is never true.
export function cleaningState(
  room: { needsCleaningFlag: boolean; lastCleanedAt: Date | null; lastInspectedAt: Date | null },
  lastDeparture: Date | null,
  inspectionRequired: boolean,
): { needsCleaning: boolean; awaitingInspection: boolean } {
  const needsCleaning =
    room.needsCleaningFlag ||
    (lastDeparture !== null && (room.lastCleanedAt === null || room.lastCleanedAt < lastDeparture));
  const awaitingInspection =
    inspectionRequired &&
    !needsCleaning &&
    room.lastCleanedAt !== null &&
    (room.lastInspectedAt === null || room.lastInspectedAt < room.lastCleanedAt);
  return { needsCleaning, awaitingInspection };
}

export type Housekeeping = {
  rooms: HousekeepingRoom[];
  toCleanCount: number;
};

// A room needs cleaning when a guest has departed (checkout on/before today)
// since it was last marked clean. A pending same-day arrival into an un-cleaned
// room is high priority — the guest is coming and the room isn't ready.
export async function getHousekeeping(): Promise<Housekeeping> {
  const today = todayDateOnly();
  const todayDate = parseDateOnly(today);

  const [rooms, departures, arrivalsToday, occupiedTonight, property] = await Promise.all([
    prisma.room.findMany({
      where: { archivedAt: null },
      include: { roomType: true },
      orderBy: [{ roomType: { name: "asc" } }, { label: "asc" }],
    }),
    // Most recent checkout on/before today, per room.
    prisma.reservation.groupBy({
      by: ["roomId"],
      where: { status: "confirmed", checkOut: { lte: todayDate } },
      _max: { checkOut: true },
    }),
    prisma.reservation.findMany({
      where: { status: "confirmed", checkIn: todayDate },
      select: { roomId: true },
    }),
    prisma.reservation.findMany({
      where: { status: "confirmed", checkIn: { lte: todayDate }, checkOut: { gt: todayDate } },
      select: { roomId: true },
    }),
    currentPropertySettings(),
  ]);

  const inspectionRequired = property?.inspectionRequired ?? false;
  const lastDepartureByRoom = new Map(departures.map((d) => [d.roomId, d._max.checkOut]));
  const arrivingTodayRooms = new Set(arrivalsToday.map((r) => r.roomId));
  const occupiedRooms = new Set(occupiedTonight.map((r) => r.roomId));

  const result: HousekeepingRoom[] = rooms.map((room) => {
    const lastDeparture = lastDepartureByRoom.get(room.id) ?? null;
    const { needsCleaning, awaitingInspection } = cleaningState(room, lastDeparture, inspectionRequired);
    const arrivalToday = arrivingTodayRooms.has(room.id);

    return {
      id: room.id,
      label: room.label,
      roomTypeName: room.roomType.name,
      needsCleaning,
      awaitingInspection,
      lastDeparture: lastDeparture ? formatDateOnly(lastDeparture) : null,
      arrivalToday,
      occupiedTonight: occupiedRooms.has(room.id),
      highPriority: needsCleaning && arrivalToday,
    };
  });

  return { rooms: result, toCleanCount: result.filter((r) => r.needsCleaning).length };
}

// ── Cleaning tasks (assignment + checklist + accountability) ─────────────────
import type { HkTaskStatus } from "@prisma/client";

export const DEFAULT_CHECKLIST = ["Bathroom", "Bed & linen", "Towels", "Restock supplies", "Trash out", "Floor & dusting"];
export type ChecklistItem = { label: string; done: boolean };

// Pure helpers (testable).
export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}
export function allDone(items: ChecklistItem[]): boolean {
  return items.length > 0 && items.every((i) => i.done);
}

export type HkTaskView = {
  assigneeStaffId: string | null;
  status: HkTaskStatus;
  checklist: ChecklistItem[];
  completedByStaffId: string | null;
  completedAt: string | null;
};

// Today's tasks keyed by roomId.
export async function getTodayTasks(): Promise<Record<string, HkTaskView>> {
  const date = parseDateOnly(todayDateOnly());
  const rows = await prisma.housekeepingTask.findMany({ where: { date } });
  const out: Record<string, HkTaskView> = {};
  for (const r of rows) {
    out[r.roomId] = {
      assigneeStaffId: r.assigneeStaffId,
      status: r.status,
      checklist: Array.isArray(r.checklist) ? (r.checklist as unknown as ChecklistItem[]) : [],
      completedByStaffId: r.completedByStaffId,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    };
  }
  return out;
}

type UpsertTaskInput = {
  roomId: string;
  assigneeStaffId?: string | null;
  checklist?: ChecklistItem[];
  complete?: boolean;
  completedByStaffId?: string | null;
};

// Assign / update checklist / complete today's task for a room. Completing also
// marks the room clean (the existing derived-cleaning flow) and stamps who did it.
export async function upsertHousekeepingTask(input: UpsertTaskInput) {
  const date = parseDateOnly(todayDateOnly());
  const existing = await prisma.housekeepingTask.findFirst({ where: { roomId: input.roomId, date } });
  const checklist =
    input.checklist ??
    (existing?.checklist as unknown as ChecklistItem[] | undefined) ??
    DEFAULT_CHECKLIST.map((label) => ({ label, done: false }));

  const data: Record<string, unknown> = {
    assigneeStaffId: input.assigneeStaffId !== undefined ? input.assigneeStaffId : (existing?.assigneeStaffId ?? null),
    checklist: checklist as unknown as object,
  };
  if (input.complete) {
    data.status = "done";
    data.completedAt = new Date();
    data.completedByStaffId = input.completedByStaffId ?? input.assigneeStaffId ?? existing?.assigneeStaffId ?? null;
  } else {
    data.status = checklist.some((c) => c.done) ? "in_progress" : "pending";
  }

  const task = existing
    ? await prisma.housekeepingTask.update({ where: { id: existing.id }, data })
    : await prisma.housekeepingTask.create({ data: { roomId: input.roomId, date, ...data } });

  if (input.complete) {
    await prisma.room.update({ where: { id: input.roomId }, data: { lastCleanedAt: new Date(), needsCleaningFlag: false } });
  }
  return task;
}
