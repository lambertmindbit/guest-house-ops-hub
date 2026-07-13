import { logError } from "@/lib/log";

// Next calls onRequestError for every UNCAUGHT server-side error — a throw in a
// route handler, a server component render failure, or middleware. Before this,
// such errors produced no server-side signal at all (no log, no trace). This is
// the one place that makes them visible; point logError's sink at Sentry to get
// alerting on top. Params are typed structurally so we don't couple to a specific
// Next minor's exported types.
export function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routeType?: string; routePath?: string },
) {
  logError("server.request-error", error, {
    path: request?.path,
    method: request?.method,
    routeType: context?.routeType,
    routePath: context?.routePath,
  });
}
