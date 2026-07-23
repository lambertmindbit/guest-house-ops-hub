import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, __resetTenantResolution } from "@/lib/prisma";
import { duplicateGroups, mergeGuests } from "@/lib/guest-merge";

describe("duplicateGroups (pure)", () => {
  it("groups guests whose phone normalises to the same number", () => {
    const groups = duplicateGroups([
      { id: "a", phone: "9998887777" },
      { id: "b", phone: "+91 99988 87777" }, // same number, different format
      { id: "c", phone: "9000000000" },
      { id: "d", phone: "091-9998887777" }, // same again
    ]);
    expect(groups).toHaveLength(1);
    expect(new Set(groups[0].guestIds)).toEqual(new Set(["a", "b", "d"]));
  });

  it("ignores blank/short numbers and singletons", () => {
    expect(duplicateGroups([{ id: "a", phone: "123" }, { id: "b", phone: "9000000000" }])).toEqual([]);
  });
});

// ─── DB: the actual merge ─────────────────────────────────────────────────────
const TAG = `merge-${Date.now()}`;
let roomId: string, channelId: string, rtId: string;
let survivorId: string, dupId: string;

beforeAll(async () => {
  __resetTenantResolution();
  const rt = await prisma.roomType.create({ data: { name: `${TAG}-t`, baseRate: 200000, maxOccupancy: 2, rateFloor: 100000, rateCeiling: 500000 } });
  rtId = rt.id;
  const [room, channel] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-A` } }),
    prisma.channel.create({ data: { name: `${TAG}-c`, commissionPct: 0, collectsPayment: false } }),
  ]);
  roomId = room.id; channelId = channel.id;

  // Survivor: has name/phone, no email. Duplicate: same person, carries the email +
  // a booking + is blocked.
  const survivor = await prisma.guest.create({ data: { name: "Ravi Kumar", phone: "9998887777", notes: "VIP" } });
  const dup = await prisma.guest.create({ data: { name: "Ravi K", phone: "+91 99988 87777", email: "ravi@example.com", blocked: true, blockReason: "Chargeback", preferences: ["quiet"] } });
  survivorId = survivor.id; dupId = dup.id;
  await prisma.reservation.create({ data: { roomId, guestId: dupId, channelId, checkIn: new Date("2031-04-10"), checkOut: new Date("2031-04-12"), grossAmount: 300000 } });
  await prisma.complaint.create({ data: { guestId: dupId, description: "AC noisy", category: "other" } });
});

afterAll(async () => {
  await prisma.complaint.deleteMany({ where: { guestId: survivorId } });
  await prisma.reservation.deleteMany({ where: { roomId } });
  await prisma.guest.deleteMany({ where: { id: { in: [survivorId, dupId] } } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { id: rtId } });
  await prisma.channel.deleteMany({ where: { id: channelId } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("mergeGuests", () => {
  it("reassigns all history, fills missing PII, keeps a block, and deletes the duplicate", async () => {
    const res = await mergeGuests(survivorId, dupId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.reassigned.reservation).toBe(1);
    expect(res.reassigned.complaint).toBe(1);

    // History moved to the survivor.
    expect(await prisma.reservation.count({ where: { guestId: survivorId } })).toBe(1);
    expect(await prisma.complaint.count({ where: { guestId: survivorId } })).toBe(1);

    const merged = await prisma.guest.findUnique({ where: { id: survivorId } });
    expect(merged!.name).toBe("Ravi Kumar"); // survivor identity kept
    expect(merged!.email).toBe("ravi@example.com"); // filled from the duplicate
    expect(merged!.notes).toBe("VIP"); // survivor's own field untouched
    expect(merged!.blocked).toBe(true); // block survives the merge
    expect(merged!.blockReason).toBe("Chargeback");
    expect(merged!.preferences).toContain("quiet");

    // Duplicate is gone.
    expect(await prisma.guest.findUnique({ where: { id: dupId } })).toBeNull();
  });

  it("refuses to merge a guest into itself", async () => {
    const r = await mergeGuests(survivorId, survivorId);
    expect(r.ok).toBe(false);
  });
});
