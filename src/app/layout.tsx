import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { NavShell } from "@/components/NavShell";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
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
const themeScript = `(function(){try{var d=document.documentElement,ls=localStorage;var ap=ls.getItem('ops-appearance')||'system';var eff=ap==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):ap;d.setAttribute('data-appearance',eff);d.setAttribute('data-tint',ls.getItem('ops-tint')||'warm');d.setAttribute('data-material',ls.getItem('ops-material')||'rich');d.setAttribute('data-btnshape',ls.getItem('ops-btnshape')||'rounded');}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <NavShell />
        {children}
      </body>
    </html>
  );
}
