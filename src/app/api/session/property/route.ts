import { z } from "zod";
import { NextResponse } from "next/server";
import { fail, zodFail, withRoute } from "@/lib/api";
import { getSession } from "@/lib/session";
import { userCanAccessProperty } from "@/lib/properties";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

// Switch the acting property (multi-location owners). Re-issues the session
// cookie with the new propertyId — only to a property the user may access.

const schema = z.object({ propertyId: z.string().min(1) });

async function handlePOST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Not signed in.", 401);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  const { propertyId } = parsed.data;

  if (!(await userCanAccessProperty(session.sub, session.propertyId, propertyId))) {
    return fail("You don't have access to that property.", 403);
  }

  await recordAudit("session.switch-property", "property", propertyId, "Switched active property").catch(() => {});
  const token = await createSessionToken({ sub: session.sub, role: session.role, propertyId });
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}

export const POST = withRoute(handlePOST);
