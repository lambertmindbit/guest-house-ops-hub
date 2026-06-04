"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Icon } from "@/components/ui";

export function IdDocumentField({
  guestId,
  configured,
  hasDocument,
}: {
  guestId: string;
  configured: boolean;
  hasDocument: boolean;
}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return (
      <div className="card" style={{ padding: 14, marginTop: 12, background: "var(--surface-2)" }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>ID document upload</div>
        <div style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 3, lineHeight: 1.5 }}>
          Not configured. Create a private Supabase Storage bucket and set the storage env vars to enable scanned-ID uploads. See <code>docs/SETUP.md</code>.
        </div>
      </div>
    );
  }

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/guests/${guestId}/id-document`, { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Upload failed.");
      return;
    }
    router.refresh();
  }

  async function view() {
    const res = await fetch(`/api/guests/${guestId}/id-document`);
    const j = await res.json();
    if (res.ok && j.data?.url) window.open(j.data.url, "_blank", "noopener");
  }

  async function remove() {
    if (!(await confirm({ title: "Remove ID document", message: "Remove the stored ID document?", danger: true, confirmLabel: "Remove" }))) return;
    await fetch(`/api/guests/${guestId}/id-document`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: 14, marginTop: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>ID document</div>
          <div style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 3 }}>
            {hasDocument ? "On file (private)" : "JPG, PNG, WEBP or PDF · max 5 MB"}
          </div>
          {error && <div style={{ color: "var(--red-text)", fontSize: 12.5, marginTop: 4 }}>{error}</div>}
        </div>
        <div className="row" style={{ gap: 6, flex: "none" }}>
          {hasDocument && (
            <>
              <button onClick={view} className="btn btn--ghost btn--sm">View</button>
              <button onClick={remove} className="btn btn--danger btn--sm">Remove</button>
            </>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn--ghost btn--sm">
            <Icon name="plus" size={15} /> {busy ? "Uploading…" : hasDocument ? "Replace" : "Upload"}
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
