import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavShell } from "@/components/NavShell";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { PwaRuntime } from "@/components/PwaRuntime";
import { getSession } from "@/lib/session";
import { listUserProperties } from "@/lib/properties";
import { unstable_cache } from "next/cache";
import { getConflicts } from "@/lib/conflicts";
import { unscopedPrisma } from "@/lib/prisma";

// Nav badge counts sit in the layout — they'd otherwise run on EVERY navigation.
// Cache both at ~60s; a slightly stale badge count is fine.
//
// Keyed BY propertyId, and scoped explicitly to it: unstable_cache runs its
// callback outside request scope, so the `x-ota-tenant` header the tenant layer
// normally reads isn't available in here. Without the propertyId in both the key
// AND the query, a multi-property deployment would serve (and cache) one tenant's
// counts to another. Hence the unscoped client + an explicit propertyId filter.
const getCachedConflictCount = (propertyId: string) =>
  unstable_cache(
    async () => (await getConflicts(propertyId)).length,
    ["nav-conflict-count", propertyId],
    { revalidate: 60 },
  )();

const getCachedEscalationCount = (propertyId: string) =>
  unstable_cache(
    async () => unscopedPrisma.escalation.count({ where: { status: "open", propertyId } }),
    ["nav-escalation-count", propertyId],
    { revalidate: 60 },
  )();

// Redesign type system: Plus Jakarta Sans (UI/body), Fraunces (display titles),
// JetBrains Mono (numerals / times / eyebrow micro-labels).
const ui = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});
const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Guest House Ops Hub",
  description: "Bookings, calendar, guests, and housekeeping in one place.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Ops Hub", statusBarStyle: "default" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

// Mobile-first: the owner runs this from a ~390px phone screen.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Applies saved preferences (or the OS appearance) before first paint — no flash.
// Redesign knobs: appearance + tint (default teal) + density (default comfortable).
const themeScript = `(function(){try{var d=document.documentElement,ls=localStorage;var ap=ls.getItem('ops-appearance')||'system';var eff=ap==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):ap;d.setAttribute('data-appearance',eff);d.setAttribute('data-tint',ls.getItem('ops-tint')||'teal');d.setAttribute('data-density',ls.getItem('ops-density')||'comfortable');}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The owner chrome (NavShell + its badge/property queries) is only for signed-in
  // users. Public surfaces (the guest chat at /chat, the login page) reach this
  // layout with no session → render just the content, no owner nav, no queries.
  const session = await getSession();
  const role = session?.role ?? "owner";
  let conflictCount = 0;
  let escalationCount = 0;
  let properties: { id: string; name: string }[] = [];
  if (session) {
    // Badge counts are per-property and cached outside request scope, so they need
    // an explicit propertyId (see the cache helpers above); skip them if unbound.
    if (session.propertyId) {
      try {
        [conflictCount, escalationCount] = await Promise.all([
          getCachedConflictCount(session.propertyId),
          getCachedEscalationCount(session.propertyId),
        ]);
      } catch {
        conflictCount = 0;
        escalationCount = 0;
      }
    }
    try {
      properties = await listUserProperties(session.sub, session.propertyId);
    } catch {
      properties = [];
    }
  }

  return (
    <html lang="en" className={`${ui.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {session && (
          <NavShell conflictCount={conflictCount} escalationCount={escalationCount} role={role} properties={properties} currentPropertyId={session.propertyId ?? null} />
        )}
        <ConfirmProvider>{children}</ConfirmProvider>
        <PwaRuntime />
      </body>
    </html>
  );
}
