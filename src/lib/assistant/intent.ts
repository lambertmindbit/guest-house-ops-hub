// Pure intent parsing for the Phase-1 stub assistant — no LLM, fully testable.
// Two input shapes:
//   • slash-commands from GenUI card buttons — deterministic, e.g.
//     `/quote <roomId> <checkIn> <checkOut>`, `/book …`, `/confirm …`
//   • free text the owner/guest types — keyword + date extraction
// Phase 2 replaces this with the real NLU; the descriptor protocol is unchanged.

export type Intent =
  | { kind: "greeting" }
  | { kind: "help" }
  | { kind: "availability"; checkIn?: string; checkOut?: string }
  | { kind: "quote"; roomId?: string; checkIn?: string; checkOut?: string }
  | { kind: "book"; roomId?: string; checkIn?: string; checkOut?: string }
  | { kind: "confirm"; roomId?: string; checkIn?: string; checkOut?: string }
  | { kind: "fallback" };

const DATE_RE = /(\d{4}-\d{2}-\d{2})/g;

function datesFrom(text: string): { checkIn?: string; checkOut?: string } {
  const found = text.match(DATE_RE) ?? [];
  return { checkIn: found[0], checkOut: found[1] };
}

export function parseIntent(raw: string): Intent {
  const message = raw.trim();
  if (!message) return { kind: "fallback" };

  // Slash-commands (from card actions) — exact and unambiguous.
  if (message.startsWith("/")) {
    const [cmd, roomId, checkIn, checkOut] = message.slice(1).split(/\s+/);
    switch (cmd) {
      case "availability": {
        const d = datesFrom(message);
        return { kind: "availability", checkIn: d.checkIn, checkOut: d.checkOut };
      }
      case "quote": return { kind: "quote", roomId, checkIn, checkOut };
      case "book": return { kind: "book", roomId, checkIn, checkOut };
      case "confirm": return { kind: "confirm", roomId, checkIn, checkOut };
      default: return { kind: "fallback" };
    }
  }

  const t = message.toLowerCase();
  const { checkIn, checkOut } = datesFrom(t);

  if (/\b(hi|hello|hey|namaste|kumno|good (morning|afternoon|evening))\b/.test(t) && t.length <= 40) {
    return { kind: "greeting" };
  }
  if (/\b(help|what can you|how do you|what do you do)\b/.test(t)) return { kind: "help" };
  if (/\b(price|cost|how much|rate|quote|charge)\b/.test(t)) return { kind: "quote", checkIn, checkOut };
  if (/\b(book|reserve|booking)\b/.test(t)) return { kind: "book", checkIn, checkOut };
  if (/\b(free|available|availability|vacan|room|stay|night)\b/.test(t)) {
    return { kind: "availability", checkIn, checkOut };
  }
  return { kind: "fallback" };
}
