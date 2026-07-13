import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logError } from "@/lib/log";

// Consistent envelope across every route: success → { data }, failure → { error }.
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// Wrap a route handler so an UNEXPECTED throw becomes a logged JSON { error } 500
// instead of Next's default (which breaks the envelope clients parse, and — before
// this — produced no log). Handlers still throw/return their own 4xx for known
// cases; this only backstops the unforeseen. The rest-arg signature is preserved
// exactly, so Next's route type-validation sees the same handler shape.
export function withRoute<A extends unknown[]>(
  handler: (req: Request, ...args: A) => Promise<Response>,
): (req: Request, ...args: A) => Promise<Response> {
  return async (req, ...args) => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      let path: string | undefined;
      try {
        path = new URL(req.url).pathname;
      } catch {
        path = undefined;
      }
      logError("api.unhandled-error", error, { path, method: req.method });
      return fail("Something went wrong. Please try again.", 500);
    }
  };
}

// Turn a Zod failure into a single friendly message for the { error } envelope.
export function zodFail(error: ZodError) {
  const first = error.issues[0];
  const path = first.path.join(".");
  return fail(path ? `${path}: ${first.message}` : first.message, 422);
}
