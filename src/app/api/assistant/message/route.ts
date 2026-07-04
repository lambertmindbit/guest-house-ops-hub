import { z } from "zod";
import { zodFail } from "@/lib/api";
import { buildTurn } from "@/lib/assistant/stub";

// POST /api/assistant/message — the chat transport for the /assistant surface.
// Streams the assistant's turn as NDJSON (one StreamChunk per line), so Phase 2
// can stream real LLM tokens through the identical pipe. Behind the owner cookie
// (not a token seam): the browser talks to this route, never to the agent.
// Phase 1 is driven by the stub agent (no LLM).

const schema = z.object({ message: z.string().min(1).max(2000) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const chunks = await buildTurn(parsed.data.message);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
