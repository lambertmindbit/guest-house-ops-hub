import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@prisma/client";
import { parseDateOnly } from "@/lib/dates";

// ── Staff ────────────────────────────────────────────────────────────────
export async function listStaff() {
  return prisma.staff.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
}
export async function createStaff(data: { name: string; role?: string | null; phone?: string | null }) {
  return prisma.staff.create({ data: { name: data.name, role: data.role ?? null, phone: data.phone ?? null } });
}

// ── Shifts ───────────────────────────────────────────────────────────────
export async function listShiftsFrom(fromDate: string) {
  return prisma.shift.findMany({
    where: { date: { gte: parseDateOnly(fromDate) } },
    orderBy: [{ date: "asc" }, { start: "asc" }],
    include: { staff: { select: { id: true, name: true } } },
  });
}
export async function createShift(data: { staffId: string; date: string; start: string; end: string; note?: string | null }) {
  return prisma.shift.create({
    data: { staffId: data.staffId, date: parseDateOnly(data.date), start: data.start, end: data.end, note: data.note ?? null },
  });
}

// ── Attendance ─────────────────────────────────────────────────────────────
export async function attendanceForDate(date: string) {
  return prisma.attendance.findMany({ where: { date: parseDateOnly(date) } });
}
// One row per staff per date (upsert on the composite unique key).
export async function setAttendance(staffId: string, date: string, status: AttendanceStatus, note?: string | null) {
  const d = parseDateOnly(date);
  const existing = await prisma.attendance.findFirst({ where: { staffId, date: d } });
  return existing
    ? prisma.attendance.update({ where: { id: existing.id }, data: { status, note: note ?? null } })
    : prisma.attendance.create({ data: { staffId, date: d, status, note: note ?? null } });
}

// ── Pure summaries (testable) ───────────────────────────────────────────────
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Scheduled hours per staff from a set of shifts (overnight shifts wrap +24h).
export function rosterHoursByStaff(
  shifts: { staffId: string; start: string; end: string }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of shifts) {
    let mins = toMinutes(s.end) - toMinutes(s.start);
    if (mins < 0) mins += 24 * 60; // overnight
    out[s.staffId] = (out[s.staffId] ?? 0) + mins / 60;
  }
  return out;
}

export function attendanceCounts(
  rows: { status: AttendanceStatus }[],
): { present: number; absent: number; leave: number } {
  const c = { present: 0, absent: 0, leave: 0 };
  for (const r of rows) c[r.status] += 1;
  return c;
}
