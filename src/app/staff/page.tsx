import { listStaff, listShiftsFrom, attendanceForDate } from "@/lib/staff";
import { todayDateOnly, formatDateOnly } from "@/lib/dates";
import { PageHead } from "@/components/ui";
import { StaffBoard } from "@/components/StaffBoard";
import { requireModule } from "@/lib/module-gate";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  await requireModule("staff");
  const today = todayDateOnly();
  const [staff, shifts, attendance] = await Promise.all([
    listStaff(),
    listShiftsFrom(today),
    attendanceForDate(today),
  ]);

  return (
    <main className="app-main" style={{ maxWidth: 820 }}>
      <div className="entrance">
        <PageHead title="Staff" sub="Directory, shift roster and today's attendance." />
        <StaffBoard
          today={today}
          staff={staff.map((s) => ({ id: s.id, name: s.name, role: s.role, phone: s.phone, active: s.active }))}
          shifts={shifts.map((sh) => ({
            id: sh.id, staffId: sh.staffId, staffName: sh.staff.name,
            date: formatDateOnly(sh.date), start: sh.start, end: sh.end, note: sh.note,
          }))}
          attendance={attendance.map((a) => ({ staffId: a.staffId, status: a.status }))}
        />
      </div>
    </main>
  );
}
