// Shared token gate for all /api/agent/* routes.
// Mirrors the /api/ingest pattern: a single shared secret carried in
// x-agent-token or Authorization: Bearer. Fails closed when AGENT_TOKEN is unset.
export function agentTokenOk(req: Request): boolean {
  const expected = process.env.AGENT_TOKEN;
  if (!expected) return false;
  const header =
    req.headers.get("x-agent-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
