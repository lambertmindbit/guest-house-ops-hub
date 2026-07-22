import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavShell } from "@/components/NavShell";
import { disabledModules } from "@/lib/module-gate";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { PwaRuntime } from "@/components/PwaRuntime";
import { getSession } from "@/lib/session";
import { getLocale } from "@/lib/i18n/server";
import { listUserProperties } from "@/lib/properties";
import { countConflicts } from "@/lib/conflicts";
import { unscopedPrisma } from "@/lib/prisma";

// The "Needs you" badge counts, computed LIVE on each render.
//
// These used to be wrapped in unstable_cache(revalidate: 60). That made the badge
// lie: the pages it points at are force-dynamic, so the moment you resolved or
// dismissed an item the page updated but the badge kept serving a stale cached
// number (and stale-while-revalidate could keep handing back the old value). A
// "Needs you" badge that disagrees with the queue is worse than no badge — the
// whole point is that the number is trustworthy. So correctness wins, and the
// cost is kept down instead: both are COUNT queries run in parallel (countConflicts
// rather than materialising every conflict row just to read .length).
//
// Both are scoped explicitly to the acting property: the raw-SQL conflicts query
// bypasses the Prisma tenant extension, so a multi-property deployment would
// otherwise leak one tenant's counts into another's badge.
async function navCounts(propertyId: string): Promise<[number, number]> {
  return Promise.all([
    countConflicts(propertyId),
    unscopedPrisma.escalation.count({ where: { status: "open", propertyId } }),
  ]);
}

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
  const locale = await getLocale();
  let conflictCount = 0;
  let escalationCount = 0;
  let properties: { id: string; name: string }[] = [];
  // Modules the vendor switched off for this property. Read once here so both the
  // sidebar and the phone "More" hub hide the same things.
  let hiddenModules: string[] = [];
  if (session) {
    // Badge counts are per-property and cached outside request scope, so they need
    // an explicit propertyId (see the cache helpers above); skip them if unbound.
    if (session.propertyId) {
      try {
        [conflictCount, escalationCount] = await navCounts(session.propertyId);
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
    try {
      hiddenModules = [...(await disabledModules())];
    } catch {
      hiddenModules = []; // a failed read must never hide the product
    }
  }

  return (
    <html lang={locale} className={`${ui.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <LocaleProvider locale={locale}>
          {session && (
            <NavShell conflictCount={conflictCount} escalationCount={escalationCount} role={role} properties={properties} currentPropertyId={session.propertyId ?? null} hiddenModules={hiddenModules} />
          )}
          <ConfirmProvider>{children}</ConfirmProvider>
        </LocaleProvider>
        <PwaRuntime />
      </body>
    </html>
  );
}
