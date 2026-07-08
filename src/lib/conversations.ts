import { prisma } from "@/lib/prisma";

// Read side of the assistant conversation log. Turns are grouped into sessions
// (one chat thread) for the owner's review screen. Dates → ISO strings at the
// boundary so the data passes cleanly to client components.

export type TurnMeta = { tools?: string[]; tokens?: number; fallback?: boolean };

export type TurnView = {
  id: string;
  userMessage: string;
  reply: string;
  createdAt: string;
  meta: TurnMeta | null;
};

export type ConversationView = {
  sessionId: string;
  mode: string; // "owner" | "public"
  turns: TurnView[];
  lastAt: string;
};

// Recent conversations, newest activity first, each with its turns in order.
export async function listRecentConversations(sessionLimit = 40): Promise<ConversationView[]> {
  // Pull a generous slice of recent turns, then fold into sessions client-safe.
  const rows = await prisma.conversationTurn.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const bySession = new Map<string, ConversationView>();
  for (const r of rows) {
    let conv = bySession.get(r.sessionId);
    if (!conv) {
      conv = { sessionId: r.sessionId, mode: r.mode, turns: [], lastAt: r.createdAt.toISOString() };
      bySession.set(r.sessionId, conv);
    }
    conv.turns.push({
      id: r.id,
      userMessage: r.userMessage,
      reply: r.reply,
      createdAt: r.createdAt.toISOString(),
      meta: (r.metadata as TurnMeta | null) ?? null,
    });
  }

  // Map insertion order is newest-first (rows are desc). Within a session the
  // turns are currently newest-first too — flip to chronological for reading.
  const conversations = [...bySession.values()].slice(0, sessionLimit);
  for (const c of conversations) c.turns.reverse();
  return conversations;
}
