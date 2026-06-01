import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Consistent envelope across every route: success → { data }, failure → { error }.
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// Turn a Zod failure into a single friendly message for the { error } envelope.
export function zodFail(error: ZodError) {
  const first = error.issues[0];
  const path = first.path.join(".");
  return fail(path ? `${path}: ${first.message}` : first.message, 422);
}
