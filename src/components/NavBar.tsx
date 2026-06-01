"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/guests", label: "Guests" },
  { href: "/housekeeping", label: "Cleaning" },
  { href: "/finance", label: "Finance" },
  { href: "/analytics", label: "Analytics" },
  { href: "/conflicts", label: "Conflicts" },
  { href: "/feeds", label: "Feeds" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  // The login screen is standalone — no app chrome.
  if (pathname === "/login") return null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
      {/* Many tabs — scroll horizontally on small screens instead of wrapping/clipping. */}
      <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto whitespace-nowrap px-4 py-3">
        <span className="shrink-0 font-semibold">Ops Hub</span>
        <nav className="flex gap-1 text-sm">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded px-3 py-1.5 ${
                  active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/reservations/new"
          className="ml-auto shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          + New
        </Link>
        <button
          onClick={logout}
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
