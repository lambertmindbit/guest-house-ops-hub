import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Guest House Ops Hub",
  description: "Bookings, calendar, guests, and housekeeping in one place.",
};

// Mobile-first: the owner runs this from a ~390px phone screen.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
