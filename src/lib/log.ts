// Minimal structured logger — no dependency. On Vercel and Cloud Run, stdout and
// stderr are captured, so one JSON line per event is enough to make failures
// visible and searchable. This is the single sink: to add Sentry/alerting later,
// change `emit` here and every call site is already wired.

type Level = "error" | "warn" | "info";

function emit(level: Level, event: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
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
