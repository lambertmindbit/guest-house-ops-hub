import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavShell } from "@/components/NavShell";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { getConflicts } from "@/lib/conflicts";

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
  // Conflict count powers the Conflicts nav badge. Tolerate DB hiccups → 0.
  let conflictCount = 0;
  try {
    conflictCount = (await getConflicts()).length;
  } catch {
    conflictCount = 0;
  }

  return (
    <html lang="en" className={`${ui.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <NavShell conflictCount={conflictCount} />
        <ConfirmProvider>{children}</ConfirmProvider>
      </body>
    </html>
  );
}
