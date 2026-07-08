import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { agentTokenOk } from "@/lib/agent-auth";
import { prisma } from "@/lib/prisma";

// POST /api/agent/turns
// The agent logs one conversation turn (user message + assembled reply) after
// each exchange, so the owner can review chats. Token-gated; best-effort on the
// agent side (a failed log never breaks a chat). Empty replies (a transient
// model blip that produced no text) are skipped — nothing worth logging.

const schema = z.object({
  sessionId: z.string().min(1).max(128),
  mode: z.enum(["owner", "public"]),
  userMessage: z.string().min(1).max(8000),
  reply: z.string().max(20000),
  // Optional per-turn diagnostics (tools called, token count, fallback flag).
  metadata: z
    .object({
      tools: z.array(z.string().max(60)).max(30).optional(),
      tokens: z.number().int().nonnegative().optional(),
      fallback: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 422);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { sessionId, mode, userMessage, reply, metadata } = parsed.data;

  if (!reply.trim()) return ok({ skipped: true });

  const turn = await prisma.conversationTurn.create({
    data: { sessionId, mode, userMessage, reply, metadata: metadata ?? undefined },
  });
  return ok({ id: turn.id }, 201);
}
