import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The reservation GET handlers read the role via currentRole; stub it per test.
vi.mock("@/lib/session", async (io) => ({ ...(await io<typeof import("@/lib/session")>()), currentRole: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { GET as listGET } from "@/app/api/reservations/route";
import { GET as detailGET } from "@/app/api/reservations/[id]/route";
import { currentRole } from "@/lib/session";
import { maskReservationMoney } from "@/lib/money-mask";

const role = vi.mocked(currentRole);
const STAMP = Date.now();
let roomId: string;
let guestId: string;
let channelId: string;
let resId: string;

beforeAll(async () => {
  const rt = await prisma.roomType.create({ data: { name: `mask-${STAMP}-t`, baseRate: 2000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 6000 } });
  const [room, guest, channel] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: rt.id, label: `mask-${STAMP}-A` } }),
    prisma.guest.create({ data: { name: `mask-${STAMP}-g`, phone: `mask-${STAMP}` } }),
    prisma.channel.create({ data: { name: `mask-${STAMP}-c`, commissionPct: 0, collectsPayment: false } }),
  ]);
  roomId = room.id; guestId = guest.id; channelId = channel.id;
  const r = await prisma.reservation.create({ data: { roomId, guestId, channelId, checkIn: new Date("2027-10-10"), checkOut: new Date("2027-10-12"), grossAmount: 5000, advanceRequired: 1000 } });
  resId = r.id;
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { guestId } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { name: `mask-${STAMP}-t` } });
  await prisma.channel.deleteMany({ where: { name: `mask-${STAMP}-c` } });
  await prisma.$disconnect();
});

describe("maskReservationMoney (pure)", () => {
  it("nulls money for non-owners and leaves nested non-money intact; owners unchanged", () => {
    const r = { id: "x", grossAmount: 5000, advanceRequired: 1000, guest: { name: "A" } };
    expect(maskReservationMoney("owner", r)).toEqual(r);
    const masked = maskReservationMoney("reception", r);
    expect(masked.grossAmount).toBeNull();
    expect(masked.advanceRequired).toBeNull();
    expect(masked.guest).toEqual({ name: "A" });
  });
  it("nulls nested payment amounts", () => {
    const r = { id: "x", grossAmount: 100, payments: [{ id: "p", amount: 50, mode: "cash" }] };
    expect(maskReservationMoney("reception", r).payments).toEqual([{ id: "p", amount: null, mode: "cash" }]);
  });
});

describe("reservation API money contract (GAP-12)", () => {
  const listReq = () => new Request("http://localhost/api/reservations?from=2027-10-01&to=2027-11-01");
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const mine = (list: { data: { id: string; grossAmount: unknown; advanceRequired: unknown }[] }) => list.data.find((r) => r.id === resId)!;

  it("an owner sees money on list and detail", async () => {
    role.mockResolvedValue("owner");
    expect(mine(await (await listGET(listReq())).json()).grossAmount).not.toBeNull();
    expect((await (await detailGET(new Request("http://x"), params(resId))).json()).data.grossAmount).not.toBeNull();
  });

  it("reception sees NO money on list or detail", async () => {
    role.mockResolvedValue("reception");
    const listed = mine(await (await listGET(listReq())).json());
    expect(listed.grossAmount).toBeNull();
    expect(listed.advanceRequired).toBeNull();
    expect((await (await detailGET(new Request("http://x"), params(resId))).json()).data.grossAmount).toBeNull();
  });

  it("housekeeping sees no money either", async () => {
    role.mockResolvedValue("housekeeping");
    expect(mine(await (await listGET(listReq())).json()).grossAmount).toBeNull();
  });
});
