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

// If the agent hasn't started responding within this window, abort and fall back
// to the stub. The abort only bounds time-to-first-byte: fetch resolves when the
// response HEADERS arrive, after which the NDJSON body streams unbounded.
//
// This was 15s, which was far too tight: a WARM, single-tool turn measured ~10s,
// so a cold start or a multi-tool turn silently blew the budget and dropped the
// guest onto the Phase-1 stub — which knows nothing about the property and
// answered a "60 people + pool" question with "which room and dates?". The stub is
// a much worse outcome than waiting a few more seconds for the real agent, so give
// the agent room. (Keeping the agent warm — Cloud Run min-instances=1 — is what
// actually prevents the cold start; this is the safety margin behind it.)
const AGENT_CONNECT_TIMEOUT_MS = 30_000;

async function proxyToAgent(message: string, sessionId: string | undefined, mode: "owner" | "public", propertyId: string | null): Promise<Response | null> {
  const url = process.env.ASSISTANT_AGENT_URL;
  if (!url) return null;
  const token = process.env.ASSISTANT_AGENT_TOKEN;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_CONNECT_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      // propertyId tells the agent which property this conversation is about, so its
      // reads scope to the right one when a client runs several. Omitted → the agent
      // and seam fall back to the sole property (single-property client).
      body: JSON.stringify({ message, sessionId, mode, propertyId }),
      signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) return null;
    return new Response(upstream.body, { headers: NDJSON_HEADERS });
  } catch {
    return null; // network error, or aborted on timeout → caller uses the stub
  } finally {
    clearTimeout(timer);
  }
}

export async function assistantStream(message: string, sessionId: string | undefined, mode: "owner" | "public", propertyId: string | null = null): Promise<Response> {
  return (await proxyToAgent(message, sessionId, mode, propertyId)) ?? stubStream(message);
}
