import { z } from "zod";
import { NextResponse } from "next/server";
import { zodFail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { createSessionToken, verifyCredentials, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

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

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // First run: if the env owner credentials match, seed the owner User (env →
    // DB) under the sole property, then log in. Otherwise reject.
    if (!verifyCredentials(email, password)) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    const property = await prisma.propertySettings.findFirst();
    user = await prisma.user.create({
      data: { email, passwordHash: hashPassword(password), role: "owner", propertyId: property?.id ?? null },
    });
  } else if (!user.active || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const token = await createSessionToken({ sub: user.id, role: user.role, propertyId: user.propertyId });
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
