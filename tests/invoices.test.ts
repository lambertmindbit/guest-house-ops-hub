import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, unscopedPrisma, __resetTenantResolution } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { issueInvoice, invoiceForReservation, cancelAndReissue } from "@/lib/invoices";

// GAP-11/US-205: issuing is snapshot-and-freeze, and the number series is a
// consecutive per-financial-year sequence the DB arbitrates. Every test runs inside
// an explicit tenant so property_id is set — matching production, where the unique
// index on (property_id, financial_year, seq) is what makes numbering safe.

const TAG = `inv-${Date.now()}`;
let propertyId: string;
let roomId: string, guestId: string, channelId: string, roomTypeId: string;

async function makeReservation(gross: number, checkIn: string, checkOut: string) {
  return withTenant(propertyId, () =>
    prisma.reservation.create({
      data: { roomId, guestId, channelId, checkIn: new Date(checkIn), checkOut: new Date(checkOut), grossAmount: gross },
    }),
  );
}

beforeAll(async () => {
  __resetTenantResolution();
  const p = await unscopedPrisma.propertySettings.create({
    data: { name: `${TAG} House`, address: "Shillong, Meghalaya", invoicePrefix: "GH" },
  });
  propertyId = p.id;
  await withTenant(propertyId, async () => {
    const rt = await prisma.roomType.create({ data: { name: `${TAG}-type`, baseRate: 250_000, maxOccupancy: 2, rateFloor: 100_000, rateCeiling: 900_000 } });
    roomTypeId = rt.id;
    const [room, guest, channel] = await Promise.all([
      prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-A` } }),
      prisma.guest.create({ data: { name: `Invoice Guest ${TAG}`, phone: `${TAG}-9` } }),
      prisma.channel.create({ data: { name: `${TAG}-ch`, commissionPct: 0, collectsPayment: false } }),
    ]);
    roomId = room.id; guestId = guest.id; channelId = channel.id;
  });
});

afterAll(async () => {
  await unscopedPrisma.invoiceLine.deleteMany({ where: { propertyId } });
  await unscopedPrisma.invoice.deleteMany({ where: { propertyId } });
  await unscopedPrisma.payment.deleteMany({ where: { propertyId } });
  await unscopedPrisma.reservation.deleteMany({ where: { propertyId } });
  await unscopedPrisma.guest.deleteMany({ where: { id: guestId } });
  await unscopedPrisma.room.deleteMany({ where: { propertyId } });
  await unscopedPrisma.roomType.deleteMany({ where: { id: roomTypeId } });
  await unscopedPrisma.channel.deleteMany({ where: { propertyId } });
  await unscopedPrisma.propertySettings.deleteMany({ where: { id: propertyId } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("invoice numbering", () => {
  it("issues a consecutive per-FY series and is idempotent per booking", async () => {
    const r1 = await makeReservation(420_000, "2030-01-05", "2030-01-07");
    const r2 = await makeReservation(300_000, "2030-01-10", "2030-01-12");

    const a = await withTenant(propertyId, () => issueInvoice(r1.id));
    const b = await withTenant(propertyId, () => issueInvoice(r2.id));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    // Consecutive, prefixed, financial-year scoped.
    expect(a.number).toMatch(/^GH\/\d{4}-\d{2}\/0001$/);
    expect(b.number).toMatch(/^GH\/\d{4}-\d{2}\/0002$/);

    // Re-issuing the SAME booking must not burn a new number.
    const again = await withTenant(propertyId, () => issueInvoice(r1.id));
    expect(again.ok && again.number).toBe(a.number);
  });

  it("never issues duplicate numbers under concurrency", async () => {
    const rs = await Promise.all([
      makeReservation(200_000, "2030-03-01", "2030-03-02"),
      makeReservation(200_000, "2030-03-03", "2030-03-04"),
      makeReservation(200_000, "2030-03-05", "2030-03-06"),
      makeReservation(200_000, "2030-03-07", "2030-03-08"),
      makeReservation(200_000, "2030-03-09", "2030-03-10"),
    ]);
    // Issue all five simultaneously — the unique index is the arbiter.
    const results = await Promise.all(rs.map((r) => withTenant(propertyId, () => issueInvoice(r.id))));
    const numbers = results.map((x) => (x.ok ? x.number : "FAILED"));
    expect(numbers).not.toContain("FAILED");
    expect(new Set(numbers).size).toBe(numbers.length); // all distinct
  });
});

describe("immutability", () => {
  it("a reprint is byte-identical after the booking changes underneath it", async () => {
    const r = await makeReservation(500_000, "2030-05-01", "2030-05-03");
    const issued = await withTenant(propertyId, () => issueInvoice(r.id));
    expect(issued.ok).toBe(true);

    const before = await withTenant(propertyId, () => invoiceForReservation(r.id));

    // Change the booking after invoicing.
    await withTenant(propertyId, () =>
      prisma.reservation.update({ where: { id: r.id }, data: { grossAmount: 999_900 } }),
    );

    const after = await withTenant(propertyId, () => invoiceForReservation(r.id));
    expect(after!.totalPaise).toBe(before!.totalPaise);
    expect(after!.taxablePaise).toBe(before!.taxablePaise);
    expect(after!.number).toBe(before!.number);
    expect(Number(after!.totalPaise)).toBe(500_000); // still the ORIGINAL amount
  });

  it("an amendment cancels and reissues rather than editing", async () => {
    const r = await makeReservation(400_000, "2030-06-01", "2030-06-03");
    const first = await withTenant(propertyId, () => issueInvoice(r.id));
    expect(first.ok).toBe(true);

    const second = await withTenant(propertyId, () => cancelAndReissue(r.id));
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.number).not.toBe(first.number); // new number in the series
    const old = await unscopedPrisma.invoice.findFirst({ where: { number: first.number, propertyId } });
    expect(old!.cancelledAt).not.toBeNull(); // retained, so the series has no gap
    const live = await withTenant(propertyId, () => invoiceForReservation(r.id));
    expect(live!.number).toBe(second.number);
  });
});

describe("server-side PDF (US-206)", () => {
  it("renders a real PDF from the issued snapshot", async () => {
    const { renderInvoicePdf } = await import("@/lib/invoice-pdf");
    const r = await makeReservation(315_000, "2030-07-01", "2030-07-02");
    await withTenant(propertyId, () => issueInvoice(r.id));
    const inv = await withTenant(propertyId, () => invoiceForReservation(r.id));

    const pdf = await renderInvoicePdf({
      number: inv!.number,
      issuedAt: inv!.issuedAt,
      cancelledAt: inv!.cancelledAt,
      propertyName: inv!.propertyName,
      propertyAddress: inv!.propertyAddress,
      propertyGstin: inv!.propertyGstin,
      guestName: inv!.guestName,
      guestPhone: inv!.guestPhone,
      nights: inv!.nights,
      taxRatePct: Number(inv!.taxRatePct),
      taxablePaise: Number(inv!.taxablePaise),
      cgstPaise: Number(inv!.cgstPaise),
      sgstPaise: Number(inv!.sgstPaise),
      roundOffPaise: Number(inv!.roundOffPaise),
      totalPaise: Number(inv!.totalPaise),
      paidPaise: Number(inv!.paidPaise),
      lines: inv!.lines.map((l) => ({ description: l.description, qty: l.qty, unitPaise: Number(l.unitPaise), amountPaise: Number(l.amountPaise) })),
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF"); // a genuine PDF, not an error page
    expect(pdf.length).toBeGreaterThan(1000);
  }, 30_000);
});

describe("GST is driven purely by the property's GSTIN (mixed pilots)", () => {
  it("no GSTIN → no tax lines; GSTIN set → slab-selected tax that reconciles", async () => {
    // Unregistered: tax-free invoice.
    await unscopedPrisma.propertySettings.update({ where: { id: propertyId }, data: { gstNumber: null } });
    const r1 = await makeReservation(420_000, "2030-08-01", "2030-08-03"); // ₹2,100/night
    await withTenant(propertyId, () => issueInvoice(r1.id));
    const plain = await withTenant(propertyId, () => invoiceForReservation(r1.id));
    expect(Number(plain!.taxRatePct)).toBe(0);
    expect(Number(plain!.cgstPaise)).toBe(0);
    expect(Number(plain!.taxablePaise)).toBe(420_000);

    // Registered: 5% band, tax extracted from the inclusive tariff.
    await unscopedPrisma.propertySettings.update({ where: { id: propertyId }, data: { gstNumber: "27AAPFU0939F1ZV" } });
    const r2 = await makeReservation(420_000, "2030-09-01", "2030-09-03");
    await withTenant(propertyId, () => issueInvoice(r2.id));
    const taxed = await withTenant(propertyId, () => invoiceForReservation(r2.id));
    expect(Number(taxed!.taxRatePct)).toBe(5);
    expect(Number(taxed!.taxablePaise)).toBe(400_000);
    expect(Number(taxed!.cgstPaise) + Number(taxed!.sgstPaise)).toBe(20_000);
    // taxable + tax + round-off reconciles to the grand total exactly.
    const recon = Number(taxed!.taxablePaise) + Number(taxed!.cgstPaise) + Number(taxed!.sgstPaise) + Number(taxed!.roundOffPaise);
    expect(recon).toBe(Number(taxed!.totalPaise));
  });
});
