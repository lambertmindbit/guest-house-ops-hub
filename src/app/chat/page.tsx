import { notFound } from "next/navigation";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { currentPropertySettings } from "@/lib/property-settings";
import { unscopedPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public, no-login guest widget (excluded from the owner cookie in middleware).
// Dark unless PUBLIC_CHAT_ENABLED=true. Posts to /api/public/assistant, which
// runs the agent in "public" mode — availability/prices + a booking REQUEST the
// owner confirms; never a reservation.
//
// Which property is this chat for? An owner with several properties embeds this on
// each property's site with `?property=<id>`; the id is sent with every message so
// the agent answers about the right one. Absent (single-property client) → the sole
// property. An id that isn't a real property is ignored (→ sole-property fallback),
// never trusted blindly.
export default async function GuestChatPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  if (process.env.PUBLIC_CHAT_ENABLED !== "true") notFound();

  const requested = (await searchParams).property;
  const known = requested
    ? await unscopedPrisma.propertySettings.findUnique({
        where: { id: requested },
        select: { id: true, name: true, publicName: true },
      })
    : null;

  // The requested property if it's real, else the sole property.
  const settings = known ?? (await currentPropertySettings().catch(() => null));
  const propertyId = settings?.id ?? null;
  const propertyName = settings?.publicName || settings?.name || "our guest house";

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 8px", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: "var(--fs-h2, 20px)" }}>{propertyName}</div>
        <div className="muted" style={{ fontSize: "var(--fs-small)" }}>Ask about rooms, dates and prices — we can send a booking request to the property for you.</div>
      </header>
      <AssistantChat
        endpoint="/api/public/assistant"
        propertyId={propertyId}
        intro={`Namaste! 👋 Welcome to ${propertyName}. Tell me your dates and I'll show you which rooms are free and what they cost — then I can send a booking request to the property for you.`}
      />
    </main>
  );
}
