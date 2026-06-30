"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

// Standalone log-out control for the phone More hub (a server page that can't
// reach NavShell's own logout). Same call: clear the cookie, then bounce to login.
export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button className="btn btn--ghost" style={{ flex: 1 }} onClick={logout}>
      <Icon name="logout" size={15} /> Log out
    </button>
  );
}
