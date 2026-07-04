import { prisma, unscopedPrisma } from "@/lib/prisma";
import type { MessageChannel, MessageSource, MessageStatus } from "@prisma/client";
import {
  bookingConfirmation, preArrivalDirections, paymentRequest, paymentReminder,
  type TemplateName,
} from "@/lib/message-templates";
import { displayDate, displayINR } from "@/lib/format";
import { todayDateOnly, parseDateOnly, addDays } from "@/lib/dates";

export type LogMessageOpts = {
  source: MessageSource;
  channel: MessageChannel;
  to: string;
  body: string;
  template?: TemplateName | null;
  guestId?: string;
  reservationId?: string;
  propertyId?: string;
};

// Provider seam. Every "send" goes through the active adapter; the default
// LogAdapter records the message without delivering it (status=logged). When a
// real WhatsApp/SMS/email provider is available it implements this interface and
// is installed via setMessageAdapter() — no caller changes. (No SDK today.)
export type MessageDraft = { channel: MessageChannel; to: string; body: string };
export type SendResult = { status: MessageStatus; sentAt?: Date; error?: string };
export type MessageAdapter = { name: string; send(draft: MessageDraft): Promise<SendResult> };

export const LogAdapter: MessageAdapter = {
  name: "log",
  async send() {
    return { status: "logged" };
  },
};

let activeAdapter: MessageAdapter = LogAdapter;
export function setMessageAdapter(adapter: MessageAdapter) {
  activeAdapter = adapter;
}

// The single function every code path calls to "send" a message. Records the
// message with the status the active adapter reports (logged today). The agents'
// API seam (POST /api/agent/messages) and the property's own triggers both call
// this, so the outbox is complete regardless of the send path.
export async function logMessage(opts: LogMessageOpts) {
  const result = await activeAdapter.send({ channel: opts.channel, to: opts.to, body: opts.body });
  return prisma.outboundMessage.create({
    data: {
      source: opts.source,
      channel: opts.channel,
      to: opts.to,
      body: opts.body,
      template: opts.template ?? null,
      status: result.status,
      sentAt: result.sentAt ?? null,
      error: result.error ?? null,
      guestId: opts.guestId,
      reservationId: opts.reservationId,
      // Only set propertyId when explicitly given; otherwise leave the key absent
      // so the tenant extension injects the active property. (Passing an explicit
      // `undefined` would override the injected value and store NULL.)
      ...(opts.propertyId ? { propertyId: opts.propertyId } : {}),
    },
  });
}

// Trigger: log a booking-confirmation message for a reservation. Best-effort and
// provider-agnostic — today it lands in the outbox as status=logged; when a real
// WhatsApp/SMS provider is wired into logMessage() it will actually send, with no
// change here or at the call site. Returns null if the reservation is gone.
export async function notifyBookingConfirmation(reservationId: string) {
  const r = await unscopedPrisma.reservation.findUnique({ where: { id: reservationId }, include: { guest: true, room: true } });
  if (!r) return null;
  const property = await settingsFor(r.propertyId);

  const nights = Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 86_400_000);
  const { body } = bookingConfirmation({
    guestName: r.guest.name,
    propertyName: property?.name ?? "our guest house",
    roomLabel: r.room.label,
    checkIn: displayDate(r.checkIn),
    checkOut: displayDate(r.checkOut),
    nights,
  });

  return logMessage({
    source: "system",
    channel: "whatsapp",
    to: r.guest.phone,
    body,
    template: "bookingConfirmation",
    guestId: r.guestId,
    reservationId: r.id,
    propertyId: r.propertyId ?? undefined,
  });
}

// ── Trigger engine ──────────────────────────────────────────────────────────
// Scheduled/event notifications, enqueued via logMessage (LogAdapter today).
// Each is idempotent: a (reservation, template) pair is only ever enqueued once,
// so re-running the daily cron never double-messages a guest.
//
// Multi-property: each reservation carries its own propertyId, so the triggers
// read reservations/settings via the UNSCOPED client and derive the property from
// the row. That lets the daily cron process EVERY property (not just the sole
// one) and keeps the property name/UPI on each message correct.

// The property's settings, by id (PropertySettings is the tenant root — not
// auto-scoped — so we look it up explicitly rather than findFirst()).
async function settingsFor(propertyId: string | null) {
  return propertyId ? unscopedPrisma.propertySettings.findUnique({ where: { id: propertyId } }) : null;
}

async function alreadySent(reservationId: string, template: TemplateName, propertyId: string | null): Promise<boolean> {
  return !!(await unscopedPrisma.outboundMessage.findFirst({
    where: { reservationId, template, ...(propertyId ? { propertyId } : {}) },
    select: { id: true },
  }));
}

function balanceOf(r: { grossAmount: unknown; payments: { amount: unknown }[] }): number {
  const gross = r.grossAmount ? Number(r.grossAmount) : 0;
  const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
  return gross - paid;
}

// Pre-arrival directions (fired for arrivals the day before check-in).
export async function notifyPreArrival(reservationId: string) {
  const r = await unscopedPrisma.reservation.findUnique({ where: { id: reservationId }, include: { guest: true } });
  if (!r) return null;
  if (await alreadySent(reservationId, "preArrivalDirections", r.propertyId)) return null;
  const property = await settingsFor(r.propertyId);
  const { body } = preArrivalDirections({
    guestName: r.guest.name,
    propertyName: property?.name ?? "our guest house",
    checkIn: displayDate(r.checkIn),
    checkInTime: property?.checkInTime ?? "14:00",
    address: property?.address ?? null,
  });
  return logMessage({ source: "system", channel: "whatsapp", to: r.guest.phone, body, template: "preArrivalDirections", guestId: r.guestId, reservationId: r.id, propertyId: r.propertyId ?? undefined });
}

// Payment request / reminder. Both no-op (return null) when nothing is due.
async function notifyPayment(reservationId: string, template: "paymentRequest" | "paymentReminder") {
  const r = await unscopedPrisma.reservation.findUnique({ where: { id: reservationId }, include: { guest: true, payments: { select: { amount: true } } } });
  if (!r) return null;
  if (await alreadySent(reservationId, template, r.propertyId)) return null;
  const balance = balanceOf(r);
  if (balance <= 0) return null;
  const property = await settingsFor(r.propertyId);
  const data = { guestName: r.guest.name, propertyName: property?.name ?? "our guest house", amountDue: displayINR(balance), upiVpa: property?.upiVpa ?? null };
  const { body } = template === "paymentRequest" ? paymentRequest(data) : paymentReminder(data);
  return logMessage({ source: "system", channel: "whatsapp", to: r.guest.phone, body, template, guestId: r.guestId, reservationId: r.id, propertyId: r.propertyId ?? undefined });
}

export const notifyPaymentRequest = (id: string) => notifyPayment(id, "paymentRequest");
export const notifyPaymentReminder = (id: string) => notifyPayment(id, "paymentReminder");

// Cron-invokable engine: enqueue pre-arrival for tomorrow's arrivals and payment
// reminders for upcoming confirmed stays with a balance. Idempotent per above.
export async function runMessagingTriggers() {
  const today = todayDateOnly();
  const tomorrow = parseDateOnly(addDays(today, 1));
  const todayDate = parseDateOnly(today);
  const in3 = parseDateOnly(addDays(today, 3));

  // Unscoped scans so the daily cron covers EVERY property; each notify derives
  // its own property from the reservation row.
  const arrivals = await unscopedPrisma.reservation.findMany({ where: { status: "confirmed", checkIn: tomorrow }, select: { id: true } });
  let preArrival = 0;
  for (const r of arrivals) if (await notifyPreArrival(r.id)) preArrival += 1;

  const upcoming = await unscopedPrisma.reservation.findMany({ where: { status: "confirmed", checkIn: { gte: todayDate, lte: in3 } }, select: { id: true } });
  let paymentReminders = 0;
  for (const r of upcoming) if (await notifyPaymentReminder(r.id)) paymentReminders += 1;

  return { preArrival, paymentReminders };
}

export async function listMessages(opts: {
  guestId?: string;
  reservationId?: string;
  limit?: number;
}) {
  return prisma.outboundMessage.findMany({
    where: {
      ...(opts.guestId ? { guestId: opts.guestId } : {}),
      ...(opts.reservationId ? { reservationId: opts.reservationId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
    include: { guest: { select: { id: true, name: true, phone: true } } },
  });
}
