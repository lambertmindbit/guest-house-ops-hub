import { z } from "zod";
import { zodFail } from "@/lib/api";
import { buildTurn } from "@/lib/assistant/stub";
import type { StreamChunk } from "@/lib/assistant/types";

// POST /api/assistant/message — the chat transport for the /assistant surface.
// Streams the assistant's turn as NDJSON (one StreamChunk per line). Behind the
// owner cookie (not a token seam): the browser talks to this route, never to the
// agent directly.
//
// Runtime is FLAG-GATED (docs/AGENT-GENUI-PLAN.md, Phase 2):
//   • ASSISTANT_AGENT_URL set → proxy to the ADK Python sidecar, which speaks the
//     identical StreamChunk NDJSON protocol, and stream it straight back.
//   • unset (or the agent is unreachable) → fall back to the Phase-1 TS stub, so
//     production never breaks before the agent is deployed.

const schema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().max(128).optional(),
});

const NDJSON_HEADERS = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" };

function stubStream(message: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const chunks = await buildTurn(message);
      for (const chunk of chunks) controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: NDJSON_HEADERS });
}

// Try the ADK sidecar; return null so the caller can fall back to the stub if the
// agent is unset, errors, or is unreachable (the demo must never break).
async function proxyToAgent(message: string, sessionId: string | undefined): Promise<Response | null> {
  const url = process.env.ASSISTANT_AGENT_URL;
  if (!url) return null;
  const token = process.env.ASSISTANT_AGENT_TOKEN;
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ message, sessionId }),
    });
    if (!upstream.ok || !upstream.body) return null;
    // The agent already speaks our StreamChunk NDJSON — pass it straight through.
    return new Response(upstream.body, { headers: NDJSON_HEADERS });
  } catch {
    return null; // unreachable → fall back
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const viaAgent = await proxyToAgent(parsed.data.message, parsed.data.sessionId);
  return viaAgent ?? stubStream(parsed.data.message);
}

// Re-exported for tests: the wire format both paths must satisfy.
export type { StreamChunk };
