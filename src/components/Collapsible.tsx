"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui";

// A section-label header that toggles its content. Children are server-rendered
// and passed in, so the heavy list stays on the server.
export function Collapsible({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <button
        type="button"
        className="section-label"
        style={{ width: "100%", background: "none", border: 0, cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="section-label__l">
          <span className="section-label__t">{title}</span>
          <span className="section-label__c">{count}</span>
        </div>
        <span className="section-label__a">
          {open ? "Hide" : "Show"}
          <Icon name={open ? "arrowUp" : "arrowDown"} size={14} />
        </span>
      </button>
      {open && children}
    </>
  );
}
