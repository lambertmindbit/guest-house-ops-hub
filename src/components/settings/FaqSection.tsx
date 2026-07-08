"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { SectionLabel } from "@/components/ui";

type FaqMedia = { photos?: string[]; mapLink?: string } | null;
type Faq = { id: string; question: string; answer: string; category: string | null; active: boolean; media: FaqMedia };

const EMPTY = { question: "", answer: "", category: "", photos: "", mapLink: "" };

export function FaqSection({ faqs }: { faqs: Faq[] }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [nf, setNf] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body: unknown, method = "POST") {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
  }

  function toBody(f: typeof EMPTY) {
    const photos = f.photos.split("\n").map((s) => s.trim()).filter(Boolean);
    const mapLink = f.mapLink.trim();
    const media = photos.length > 0 || mapLink ? { ...(photos.length ? { photos } : {}), ...(mapLink ? { mapLink } : {}) } : null;
    return { question: f.question.trim(), answer: f.answer.trim(), category: f.category.trim() || null, media };
  }
  function startEdit(f: Faq) {
    setEditId(f.id);
    setEdit({
      question: f.question, answer: f.answer, category: f.category ?? "",
      photos: (f.media?.photos ?? []).join("\n"), mapLink: f.media?.mapLink ?? "",
    });
  }
  async function saveEdit(id: string) {
    if (!edit.question.trim() || !edit.answer.trim()) return;
    if (await call(`/api/faq/${id}`, toBody(edit), "PATCH")) setEditId(null);
  }

  function fields(f: typeof EMPTY, set: (v: typeof EMPTY) => void) {
    return (
      <div className="col" style={{ gap: 8 }}>
        <input className="input" placeholder="Question (e.g. Do you have parking?)" value={f.question} onChange={(e) => set({ ...f, question: e.target.value })} />
        <textarea className="textarea" style={{ minHeight: 60 }} placeholder="Answer the assistant will give guests" value={f.answer} onChange={(e) => set({ ...f, answer: e.target.value })} />
        <input className="input" placeholder="Category (optional — e.g. Facilities)" value={f.category} onChange={(e) => set({ ...f, category: e.target.value })} />
        <details>
          <summary className="muted" style={{ fontSize: "var(--fs-small)", cursor: "pointer" }}>Media (optional) — photos & a map link</summary>
          <div className="col" style={{ gap: 8, marginTop: 8 }}>
            <textarea className="textarea" style={{ minHeight: 48 }} placeholder="Photo URLs — one per line" value={f.photos} onChange={(e) => set({ ...f, photos: e.target.value })} />
            <input className="input" placeholder="Map link (optional — a Google Maps URL)" value={f.mapLink} onChange={(e) => set({ ...f, mapLink: e.target.value })} />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)" }}>{error}</p>}
      <p className="muted" style={{ fontSize: "var(--fs-small)", marginTop: 0 }}>
        These power the guest chat assistant — it answers common questions from what you write here.
      </p>

      <div className="card card--pad" style={{ marginBottom: 12 }}>
        {fields(nf, setNf)}
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} disabled={!nf.question.trim() || !nf.answer.trim()}
          onClick={async () => { if (await call("/api/faq", toBody(nf))) setNf(EMPTY); }}>
          Add FAQ
        </button>
      </div>

      <SectionLabel count={faqs.length}>Questions</SectionLabel>
      <div className="col" style={{ gap: 8 }}>
        {faqs.length === 0 ? <div className="empty">No FAQs yet. Add the questions guests ask most.</div> : faqs.map((f) => (
          editId === f.id ? (
            <div key={f.id} className="card card--pad" style={{ padding: 12 }}>
              {fields(edit, setEdit)}
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <button className="btn btn--primary btn--sm" onClick={() => saveEdit(f.id)} disabled={!edit.question.trim() || !edit.answer.trim()}>Save</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setEditId(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={f.id} className="card card--pad" style={{ padding: 12, opacity: f.active ? 1 : 0.55 }}>
              <div className="spread" style={{ gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{f.question}{f.category ? <span className="badge badge--neutral" style={{ marginLeft: 8 }}>{f.category}</span> : null}{(f.media?.photos?.length || f.media?.mapLink) ? <span className="badge badge--neutral" style={{ marginLeft: 8 }}>📷 media</span> : null}{!f.active && <span className="badge badge--neutral" style={{ marginLeft: 8 }}>Hidden</span>}</div>
                  <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 3, whiteSpace: "pre-wrap" }}>{f.answer}</div>
                </div>
                <div className="row" style={{ gap: 6, flex: "none" }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => call(`/api/faq/${f.id}`, { active: !f.active }, "PATCH")}>{f.active ? "Hide" : "Show"}</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => startEdit(f)}>Edit</button>
                  <button className="btn btn--quiet btn--icon btn--sm" onClick={async () => { if (await confirm({ title: "Delete FAQ", message: "Delete this question and answer?", danger: true, confirmLabel: "Delete" })) call(`/api/faq/${f.id}`, {}, "DELETE"); }} aria-label="Delete FAQ">✕</button>
                </div>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
