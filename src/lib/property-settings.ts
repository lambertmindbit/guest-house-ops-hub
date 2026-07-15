import type { PropertySettings } from "@prisma/client";
import { unscopedPrisma } from "@/lib/prisma";
import { requestPropertyId } from "@/lib/tenant";

// "This property's settings" — resolved to the ACTING property, always.
//
// PropertySettings is the tenant ROOT: it is deliberately absent from
// TENANT_MODELS, so the tenant extension never scopes it. That means
// `prisma.propertySettings.findFirst()` returns whichever row happens to come
// first — NOT the current property. It is correct by accident with one property
// and silently wrong the moment there are two: the invoice prints the wrong GSTIN,
// pricing reads the wrong config, the booking form applies the wrong ID policy.
//
// This is the single resolver every "get this property's settings" read must use.
// Same shape as the module gate's settingsFor(): resolve the acting property, look
// it up by id; when unbound (a script, a cron with no session) fall back only if
// there is exactly one property to fall back to.
export async function currentPropertySettings(
  propertyId?: string | null,
): Promise<PropertySettings | null> {
  const pid = await requestPropertyId(propertyId);
  if (pid) {
    return unscopedPrisma.propertySettings.findUnique({ where: { id: pid } });
  }
  const rows = await unscopedPrisma.propertySettings.findMany({ take: 2 });
  return rows.length === 1 ? rows[0] : null;
}
