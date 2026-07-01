import { prisma } from "@/lib/prisma";
import type { MessageChannel, MessageSource } from "@prisma/client";
import { bookingConfirmation } from "@/lib/message-templates";
import { displayDate } from "@/lib/format";

export type LogMessageOpts = {
  source: MessageSource;
  channel: MessageChannel;
  to: string;
  body: string;
  guestId?: string;
  reservationId?: string;
  propertyId?: string;
};

// LogAdapter — the single function every code path calls to "send" a message.
//
// Today: always writes status=logged (no actual delivery). Forward-compat hook:
// when a provider (WhatsApp Business, SMS, email) is wired up in a later phase,
// add its send logic here and flip status to 'sent' / 'failed'. The agents' API
// seam (POST /api/agent/messages) and the property's own triggers both call this
// function so the outbox is complete regardless of the send path.
export async function logMessage(opts: LogMessageOpts) {
  return prisma.outboundMessage.create({
    data: {
      source: opts.source,
      channel: opts.channel,
      to: opts.to,
      body: opts.body,
      status: "logged",
      guestId: opts.guestId,
      reservationId: opts.reservationId,
      propertyId: opts.propertyId,
    },
  });
}

// Trigger: log a booking-confirmation message for a reservation. Best-effort and
// provider-agnostic — today it lands in the outbox as status=logged; when a real
// WhatsApp/SMS provider is wired into logMessage() it will actually send, with no
// change here or at the call site. Returns null if the reservation is gone.
export async function notifyBookingConfirmation(reservationId: string) {
  const [r, property] = await Promise.all([
    prisma.reservation.findUnique({ where: { id: reservationId }, include: { guest: true, room: true } }),
    prisma.propertySettings.findFirst(),
  ]);
  if (!r) return null;

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
    guestId: r.guestId,
    reservationId: r.id,
  });
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
