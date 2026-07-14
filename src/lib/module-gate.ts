import { notFound } from "next/navigation";
import { unscopedPrisma } from "@/lib/prisma";
import { requestPropertyId } from "@/lib/tenant";
import { disabledSet, type ModuleId } from "@/lib/modules";

// Server-side enforcement of module visibility.
//
// The nav filter alone is not enough: hiding a link leaves the page reachable by
// URL, bookmark, or a link the AI happens to generate — and the person we are
// hiding it from is the OWNER, who has every role. So a disabled module's page
// must also refuse to render.
//
// This is a PACKAGING boundary, not a security boundary. It decides what a client
// bought, not what they may know about themselves. The APIs stay role-gated as
// before; we do not pretend a hidden module is a secret.
//
// ── PropertySettings IS NOT AUTO-SCOPED ──────────────────────────────────────
// It is the tenant ROOT, so it is deliberately absent from TENANT_MODELS in
// src/lib/prisma.ts — the extension never injects propertyId into it. A
// `findFirst()` therefore returns WHICHEVER property row comes first, not the
// current one. Harmless with a single property; silently wrong the moment a client
// owns two, which is exactly the case this feature exists for. So we resolve the
// acting property and look it up BY ID, the same way messaging.ts does.

/** The acting property's row, or null when we cannot say which property that is. */
async function settingsFor(propertyId?: string | null) {
  const pid = await requestPropertyId(propertyId);
  if (pid) {
    return unscopedPrisma.propertySettings.findUnique({
      where: { id: pid },
      select: { disabledModules: true },
    });
  }
  // Unbound: a script, a test, or a single-property deployment with no session.
  // Only safe to answer when there is exactly ONE property — with several and no
  // binding, we genuinely do not know whose settings to apply, and guessing would
  // hide modules from the wrong client's app.
  const rows = await unscopedPrisma.propertySettings.findMany({
    select: { disabledModules: true },
    take: 2,
  });
  return rows.length === 1 ? rows[0] : null;
}

/**
 * Modules switched off for the acting property.
 *
 * Fails OPEN (empty set = nothing hidden). A module wrongly shown is a support
 * call; a module wrongly hidden looks like the product is broken, and the client
 * cannot fix it themselves.
 */
export async function disabledModules(propertyId?: string | null): Promise<Set<ModuleId>> {
  const settings = await settingsFor(propertyId);
  return disabledSet(settings?.disabledModules ?? []);
}

/**
 * 404 unless the acting property has this module.
 *
 * Call at the top of a gated page. 404 rather than 403 — a module the client
 * didn't buy shouldn't announce itself as a locked door.
 */
export async function requireModule(id: ModuleId): Promise<void> {
  const disabled = await disabledModules();
  if (disabled.has(id)) notFound();
}
