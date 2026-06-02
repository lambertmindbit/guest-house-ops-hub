"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (e.g. non-HTTPS); the URL is still selectable.
    }
  }

  return (
    <button onClick={copy} className="btn btn--outline btn--sm" style={{ flex: "none" }}>
      <Icon name={copied ? "check" : "copy"} size={15} /> {copied ? "Copied" : "Copy"}
    </button>
  );
}
