import Link from "next/link";
import { Icon } from "@/components/ui";

// Shared header for a focused Settings sub-page: back to the hub + title.
export function SubHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <Link href="/settings" className="backlink"><Icon name="chevronL" size={15} /> Settings</Link>
      <div className="pagehead">
        <div className="display">{title}</div>
        <div className="pagehead__sub">{sub}</div>
      </div>
    </>
  );
}
