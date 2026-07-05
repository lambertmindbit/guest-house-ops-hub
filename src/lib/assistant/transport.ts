import { buildTurn } from "@/lib/assistant/stub";

// Shared chat transport for both the in-app assistant (owner) and the public
// guest widget. Streams NDJSON StreamChunks. When ASSISTANT_AGENT_URL is set it
// proxies to the ADK sidecar (passing `mode`, which decides owner-booking vs
// public booking-request); unset or unreachable → the Phase-1 stub, so nothing
// breaks. The browser never talks to the agent directly.

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

async function proxyToAgent(message: string, sessionId: string | undefined, mode: "owner" | "public"): Promise<Response | null> {
  const url = process.env.ASSISTANT_AGENT_URL;
  if (!url) return null;
  const token = process.env.ASSISTANT_AGENT_TOKEN;
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ message, sessionId, mode }),
    });
    if (!upstream.ok || !upstream.body) return null;
    return new Response(upstream.body, { headers: NDJSON_HEADERS });
  } catch {
    return null;
  }
}

export async function assistantStream(message: string, sessionId: string | undefined, mode: "owner" | "public"): Promise<Response> {
  return (await proxyToAgent(message, sessionId, mode)) ?? stubStream(message);
}
