import { prisma } from "@/lib/prisma";
import { computeInvoice, financialYearOf, formatInvoiceNumber, type GstSlab } from "@/lib/gst";
import { currentPropertySettings } from "@/lib/property-settings";

// Statutory invoicing (GAP-11/US-205). Issuing snapshots every figure, so a reprint
// is byte-identical forever — nothing downstream ever recomputes an issued invoice.

// Worst case, N simultaneous issues make the last one retry N times (each round
// exactly one writer wins the unique index and the rest fall back). The budget must
// therefore comfortably exceed realistic concurrency — a budget equal to the number
// of racers fails the very race it exists to survive.
const MAX_SEQ_ATTEMPTS = 25;

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

const nightsBetween = (a: Date, b: Date) => Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));

// A property may override the statutory slabs (rates are config, not code). Bad or
// absent JSON falls back to the defaults rather than throwing mid-invoice.
function slabsFrom(raw: unknown): GstSlab[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const parsed = raw.filter(
    (s): s is GstSlab =>
      typeof s === "object" && s !== null &&
      typeof (s as GstSlab).ratePct === "number" &&
      ((s as GstSlab).uptoPaise === null || typeof (s as GstSlab).uptoPaise === "number"),
  );
  return parsed.length > 0 ? parsed : undefined;
}

export type IssueResult =
  | { ok: true; invoiceId: string; number: string }
  | { ok: false; error: string };

// The live (non-cancelled) invoice for a booking, with its lines.
export async function invoiceForReservation(reservationId: string) {
  return prisma.invoice.findFirst({
    where: { reservationId, cancelledAt: null },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
}

// Issue an invoice for a booking. Idempotent by design: a booking that already has
// a live invoice returns that one rather than burning a number in the series.
export async function issueInvoice(reservationId: string): Promise<IssueResult> {
  const existing = await invoiceForReservation(reservationId);
  if (existing) return { ok: true, invoiceId: existing.id, number: existing.number };

  const [reservation, property] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: { include: { roomType: true } }, payments: true },
    }),
    currentPropertySettings(),
  ]);
  if (!reservation) return { ok: false, error: "Booking not found." };
  if (reservation.grossAmount === null) return { ok: false, error: "Set the booking amount before invoicing." };

  const grossPaise = Number(reservation.grossAmount);
  const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
  const computed = computeInvoice({
    grossPaise,
    nights,
    gstin: property?.gstNumber,
    slabs: slabsFrom(property?.gstSlabs),
  });
  const paidPaise = reservation.payments.reduce((s, p) => s + Number(p.amount), 0);

  const issuedAt = new Date();
  const fy = financialYearOf(issuedAt);
  const prefix = property?.invoicePrefix ?? "INV";

  // Allocate the next number in the series. The unique index on
  // (property_id, financial_year, seq) is the arbiter — if two issues race, the
  // loser gets P2002 and retries with the next free seq, so numbers are never
  // duplicated and the series stays consecutive.
  for (let attempt = 0; attempt < MAX_SEQ_ATTEMPTS; attempt++) {
    const last = await prisma.invoice.findFirst({
      where: { financialYear: fy },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    const seq = (last?.seq ?? 0) + 1;

    try {
      const invoice = await prisma.invoice.create({
        data: {
          reservationId,
          number: formatInvoiceNumber(prefix, fy, seq),
          financialYear: fy,
          seq,
          issuedAt,
          propertyName: property?.name ?? "Guest House",
          propertyAddress: property?.address ?? null,
          propertyGstin: property?.gstNumber ?? null,
          guestName: reservation.guest.name,
          guestPhone: reservation.guest.phone,
          nights: computed.nights,
          taxRatePct: computed.breakdown?.ratePct ?? 0,
          taxablePaise: computed.breakdown?.taxablePaise ?? grossPaise,
          cgstPaise: computed.breakdown?.cgstPaise ?? 0,
          sgstPaise: computed.breakdown?.sgstPaise ?? 0,
          roundOffPaise: computed.roundOffPaise,
          totalPaise: computed.totalPaise,
          paidPaise,
          lines: {
            create: [
              {
                description: `${reservation.room.roomType.name} · Room ${reservation.room.label}`,
                qty: computed.nights,
                unitPaise: computed.perNightPaise,
                amountPaise: grossPaise,
                sortOrder: 0,
              },
            ],
          },
        },
      });
      return { ok: true, invoiceId: invoice.id, number: invoice.number };
    } catch (e) {
      if (isUniqueViolation(e)) continue; // someone took this seq — try the next
      throw e;
    }
  }
  return { ok: false, error: "Could not allocate an invoice number. Try again." };
}

// Amendment path: an issued invoice is never edited. Cancel it (it stays in the
// series, so numbering has no gaps) and issue a fresh one from current data.
export async function cancelAndReissue(reservationId: string): Promise<IssueResult> {
  const live = await invoiceForReservation(reservationId);
  if (live) await prisma.invoice.update({ where: { id: live.id }, data: { cancelledAt: new Date() } });
  return issueInvoice(reservationId);
}
