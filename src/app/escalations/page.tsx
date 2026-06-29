import { listEscalations, escalationStats } from "@/lib/escalations";
import EscalationsClient from "@/components/EscalationsClient";

// /escalations — the human-in-the-loop queue shared by every ROOT agent.
// Reads happen here in the Server Component (lib → Prisma directly); the client
// island handles interactivity (filter, claim, resolve) and calls back to the
// API + router.refresh().

export const dynamic = "force-dynamic";

export default async function EscalationsPage() {
  const [stats, initial] = await Promise.all([
    escalationStats(),
    listEscalations({}),
  ]);

  return <EscalationsClient initialStats={stats} initialItems={initial} />;
}
