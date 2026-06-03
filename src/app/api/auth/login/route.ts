import { z } from "zod";
import { NextResponse } from "next/server";
import { zodFail } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  createSessionToken,
  verifyCredentials,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

const schema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

// Blunt brute-force: 10 attempts per IP per 5 minutes.
const LIMIT = 10;
const WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const limit = rateLimit(`login:${clientIp(request)}`, LIMIT, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const { email, password } = parsed.data;
  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const token = await createSessionToken(email);
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
