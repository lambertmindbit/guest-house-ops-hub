import { prisma } from "@/lib/prisma";
import type { MessageChannel, MessageSource } from "@prisma/client";

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
