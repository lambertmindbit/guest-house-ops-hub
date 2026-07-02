import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, __resetTenantResolution } from "@/lib/prisma";
import { listUserProperties, userCanAccessProperty } from "@/lib/properties";

const TAG = `prop-${Date.now()}`;
let P1: string;
let P2: string;
let P3: string;
let userId: string;

beforeAll(async () => {
  __resetTenantResolution();
  P1 = (await prisma.propertySettings.create({ data: { name: `${TAG}-1` } })).id;
  P2 = (await prisma.propertySettings.create({ data: { name: `${TAG}-2` } })).id;
  P3 = (await prisma.propertySettings.create({ data: { name: `${TAG}-3` } })).id;
  userId = (await prisma.user.create({ data: { email: `${TAG}@demo.local`, passwordHash: "x", role: "owner", propertyId: P1 } })).id;
  await prisma.userProperty.create({ data: { userId, propertyId: P2 } });
});

afterAll(async () => {
  await prisma.userProperty.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.propertySettings.deleteMany({ where: { id: { in: [P1, P2, P3] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("multi-location property access", () => {
  it("lists the primary property + memberships (deduped)", async () => {
    const props = await listUserProperties(userId, P1);
    const ids = props.map((p) => p.id).sort();
    expect(ids).toEqual([P1, P2].sort());
  });

  it("authorizes the primary and memberships, denies others", async () => {
    expect(await userCanAccessProperty(userId, P1, P1)).toBe(true);
    expect(await userCanAccessProperty(userId, P1, P2)).toBe(true);
    expect(await userCanAccessProperty(userId, P1, P3)).toBe(false);
  });
});
