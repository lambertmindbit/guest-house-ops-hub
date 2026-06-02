"use client";

import { Icon } from "@/components/ui";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn btn--primary btn--sm">
      <Icon name="copy" size={16} /> Print / Save PDF
    </button>
  );
}
