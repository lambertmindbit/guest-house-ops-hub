import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

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
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
