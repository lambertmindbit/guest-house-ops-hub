"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { POLICY_INTENTS, type PolicyView } from "@/lib/policy-intents";

// One editable card per curated intent. Saving upserts that intent's guidance;
// it reaches the live assistant within about a minute (the agent re-reads
// policies each turn, lightly cached). No add/delete — the intent set is fixed.

export function AssistantRulesSection({ policies }: { policies: PolicyView[] }) {
  const router = useRouter();
  const byIntent = new Map(policies.map((p) => [p.intent, p]));

  return (
    <div className="col" style={{ gap: 12 }}>
      <p className="muted" style={{ fontSize: "var(--fs-small)", marginTop: 0 }}>
        Guidance the chat assistant follows on top of its built-in rules. It can add to or refine what the
        assistant says — it can never turn off safety or booking protections. Leave a box empty to use the defaults.
      </p>
      {POLICY_INTENTS.map((meta) => (
        <IntentCard key={meta.intent} meta={meta} existing={byIntent.get(meta.intent)} onSaved={() => router.refresh()} />
      ))}
    </div>
  );
}

function IntentCard({
  meta,
  existing,
  onSaved,
}: {
  meta: (typeof POLICY_INTENTS)[number];
  existing: PolicyView | undefined;
  onSaved: () => void;
}) {
  const [text, setText] = useState(existing?.instructions ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = text !== (existing?.instructions ?? "");

  async function save() {
    setStatus("saving");
    const res = await fetch("/api/policies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent: meta.intent, instructions: text.trim() }),
    });
    if (res.ok) {
      setStatus("saved");
      onSaved();
      setTimeout(() => setStatus("idle"), 2500);
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="card card--pad" style={{ padding: 14 }}>
      <div style={{ fontWeight: 600 }}>{meta.label}</div>
      <div className="muted" style={{ fontSize: "var(--fs-meta)", margin: "3px 0 8px" }}>{meta.hint}</div>
      <textarea
        className="textarea"
        style={{ minHeight: 72 }}
        placeholder={meta.placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row" style={{ gap: 8, marginTop: 8, alignItems: "center" }}>
        <button className="btn btn--primary btn--sm" onClick={save} disabled={!dirty || status === "saving"}>
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {status === "saved" && <span className="muted" style={{ fontSize: "var(--fs-small)", color: "var(--green-text, var(--good-text))" }}>Saved — live within a minute</span>}
        {status === "error" && <span style={{ fontSize: "var(--fs-small)", color: "var(--red-text)" }}>Couldn’t save — try again</span>}
      </div>
    </div>
  );
}
