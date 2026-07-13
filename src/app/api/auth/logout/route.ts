import { withRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

async function handlePOST() {
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export const POST = withRoute(handlePOST);
