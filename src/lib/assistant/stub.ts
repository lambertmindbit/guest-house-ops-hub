import { prisma } from "@/lib/prisma";
import { freeRooms } from "@/lib/availability";
import { quoteRoomType } from "@/lib/pricing";
import { displayINR } from "@/lib/format";
import { parseIntent } from "@/lib/assistant/intent";
import type { StreamChunk, RoomCardData } from "@/lib/assistant/types";

// Phase-1 stub "agent": no LLM, but it drives the GenUI end-to-end with REAL PMS
// data so the whole surface (chat → tools → cards) is proven at zero LLM cost.
// Phase 2 replaces buildTurn() with the ADK sidecar; the StreamChunk protocol and
// every card renderer stay identical. See docs/AGENT-GENUI-PLAN.md.

function validRange(checkIn?: string, checkOut?: string): checkIn is string {
  return !!checkIn && !!checkOut && /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && checkOut > checkIn;
}

async function roomCards(checkIn: string, checkOut: string): Promise<RoomCardData[]> {
  const rooms = await freeRooms(checkIn, checkOut);
  const types = await prisma.roomType.findMany({ select: { id: true, baseRate: true, maxOccupancy: true } });
  const byType = new Map(types.map((t) => [t.id, { rate: Number(t.baseRate), maxOccupancy: t.maxOccupancy }]));
  return rooms
    .filter((r) => r.free)
    .map((r) => {
      const meta = byType.get(r.roomTypeId);
      return {
        id: r.id,
        label: r.label,
        roomTypeName: r.roomTypeName,
        maxOccupancy: meta?.maxOccupancy ?? 0,
        rate: meta?.rate ?? 0,
        free: true,
      };
    });
}

const GREETING =
  "Namaste! 👋 I can check which rooms are free, quote a price, and start a booking. " +
  "Try: *rooms free 2026-08-01 to 2026-08-03*.";
const HELP =
  "Here's what I can do right now:\n" +
  "• **Availability** — “what rooms are free 2026-08-01 to 2026-08-03?”\n" +
  "• **Price** — I'll quote a room for your dates\n" +
  "• **Book** — I'll show a confirmation before anything is saved\n" +
  "Cancellations and refunds always go to the owner to approve — I never do those myself.";

// Produce the ordered stream chunks for one user message.
export async function buildTurn(message: string): Promise<StreamChunk[]> {
  const intent = parseIntent(message);
  const out: StreamChunk[] = [];
  const text = (t: string) => out.push({ type: "text", delta: t });

  try {
    switch (intent.kind) {
      case "greeting": text(GREETING); break;
      case "help": text(HELP); break;

      case "availability": {
        if (!validRange(intent.checkIn, intent.checkOut)) {
          text("Sure — which dates? Give me a check-in and check-out, e.g. *2026-08-01 to 2026-08-03*.");
          break;
        }
        const cards = await roomCards(intent.checkIn, intent.checkOut!);
        if (cards.length === 0) {
          text(`Nothing's free for ${intent.checkIn} → ${intent.checkOut}. Want me to try other dates?`);
          break;
        }
        text(`Here's what's free for ${intent.checkIn} → ${intent.checkOut}:`);
        out.push({ type: "ui", component: { type: "rooms", data: cards, checkIn: intent.checkIn, checkOut: intent.checkOut! } });
        break;
      }

      case "quote": {
        if (!intent.roomId || !validRange(intent.checkIn, intent.checkOut)) {
          text("Tell me the room and your dates and I'll quote it — or ask for availability first and tap a room.");
          break;
        }
        const room = await prisma.room.findUnique({ where: { id: intent.roomId }, include: { roomType: true } });
        if (!room) { text("I couldn't find that room — it may have changed. Try asking for availability again."); break; }
        const q = await quoteRoomType(room.roomTypeId, intent.checkIn, intent.checkOut!);
        const nights = q.nights.length;
        out.push({
          type: "ui",
          component: {
            type: "quote",
            data: { roomId: room.id, roomLabel: room.label, roomTypeName: room.roomType.name, checkIn: intent.checkIn, checkOut: intent.checkOut!, nights, total: q.total },
          },
        });
        text(`That's ${displayINR(q.total)} for ${nights} night${nights === 1 ? "" : "s"}. Want to book it?`);
        break;
      }

      case "book": {
        if (!intent.roomId || !validRange(intent.checkIn, intent.checkOut)) {
          text("Happy to — which room and dates? Ask for availability and tap **Book** on a room to start.");
          break;
        }
        const room = await prisma.room.findUnique({ where: { id: intent.roomId }, include: { roomType: true } });
        if (!room) { text("That room isn't available anymore. Let's check availability again."); break; }
        const q = await quoteRoomType(room.roomTypeId, intent.checkIn, intent.checkOut!);
        const nights = q.nights.length;
        text("Please review and confirm:");
        out.push({
          type: "ui",
          component: {
            type: "confirm_booking",
            data: { roomId: room.id, roomLabel: room.label, roomTypeName: room.roomType.name, checkIn: intent.checkIn, checkOut: intent.checkOut!, nights, total: q.total },
          },
        });
        break;
      }

      case "confirm":
        // Phase 1 does not write. Phase 3 wires this to POST /api/agent/reservations
        // (the guarded, GiST-checked path) with the demo-mode OTP flow.
        text("✅ In the live assistant this books the room through the PMS — with the double-booking check and an owner-visible record. This preview doesn't save a booking yet.");
        break;

      default:
        text("I can help with **availability**, **prices**, and **bookings**. Try *rooms free 2026-08-01 to 2026-08-03*.");
    }
  } catch {
    out.length = 0;
    out.push({ type: "error", message: "Something went wrong on my side — please try again." });
  }

  out.push({ type: "done" });
  return out;
}
