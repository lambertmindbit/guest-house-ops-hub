// Minimal structured logger — no dependency. On Vercel and Cloud Run, stdout and
// stderr are captured, so one JSON line per event is enough to make failures
// visible and searchable. This is the single sink (GAP-17): errors are ALSO
// forwarded to an external collector when ERROR_WEBHOOK_URL is set — dependency-free
// alerting so a production error surfaces somewhere you'll see it (a Slack/Discord
// incoming webhook, or any endpoint) rather than only in log storage. Off by default.

type Level = "error" | "warn" | "info";

// Fire-and-forget POST to the error webhook. Server-only (ERROR_WEBHOOK_URL is not a
// NEXT_PUBLIC var, so it's undefined in the browser). A failed alert must never throw
// into the code that was already handling an error.
function forward(level: Level, event: string, fields?: Record<string, unknown>) {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  const summary = `[${level.toUpperCase()}] ${event}${fields?.error ? ` — ${(fields.error as { message?: string })?.message ?? fields.error}` : ""}`;
  // `text` (Slack) and `content` (Discord) are both set so common incoming webhooks
  // render it out of the box; the structured payload rides alongside.
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: summary, content: summary, level, event, ...fields }),
  }).catch(() => {});
}

function emit(level: Level, event: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  if (level === "error") forward(level, event, fields);
}

// Log an error with its stack flattened into the structured line. `event` is a
// stable, greppable key (e.g. "server.request-error"); `fields` add context.
export function logError(event: string, error: unknown, fields?: Record<string, unknown>) {
  emit("error", event, {
    ...fields,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
  });
}

export function logWarn(event: string, fields?: Record<string, unknown>) {
  emit("warn", event, fields);
}

export function logInfo(event: string, fields?: Record<string, unknown>) {
  emit("info", event, fields);
}
