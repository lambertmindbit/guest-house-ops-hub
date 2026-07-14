import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { disabledSet, isModuleEnabled, type ModuleId } from "@/lib/modules";

// Server-side enforcement of module visibility.
//
// The nav filter alone is not enough: hiding a link leaves the page reachable by
// URL, bookmark, or a link the AI happens to generate — and the person we are
// hiding it from is the OWNER, who has every role. So a disabled module's page
// must also refuse to render.
//
// This is a PACKAGING boundary, not a security boundary. It decides what a client
// bought, not what they are allowed to see about themselves. The underlying APIs
// stay role-gated as before; we do not pretend a hidden module is a secret.

/** Modules switched off for the current property. Empty when nothing is hidden. */
export async function disabledModules(): Promise<Set<ModuleId>> {
  // PropertySettings is the tenant root; the extension resolves it to the
  // request's property, so this is already the right row.
  const settings = await prisma.propertySettings.findFirst({
    select: { disabledModules: true },
  });
  return disabledSet(settings?.disabledModules ?? []);
}

/**
 * 404 unless this property has the module.
 *
 * Call at the top of a gated page. 404 rather than 403 — a module the client
 * didn't buy shouldn't announce itself as a locked door.
 */
export async function requireModule(id: ModuleId): Promise<void> {
  const settings = await prisma.propertySettings.findFirst({
    select: { disabledModules: true },
  });
  if (!isModuleEnabled(id, settings?.disabledModules ?? [])) notFound();
}
