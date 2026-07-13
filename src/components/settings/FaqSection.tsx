"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { SectionLabel } from "@/components/ui";

type FaqMedia = { photos?: string[]; mapLink?: string } | null;
type Faq = { id: string; question: string; answer: string; category: string | null; active: boolean; media: FaqMedia };

const EMPTY = { question: "", answer: "", category: "", photos: "", mapLink: "" };

type ImportRow = { row: number; status: "created" | "updated" | "error"; message: string };
type ImportPreview = { csv: string; fileName: string; created: number; updated: number; errors: number; results: ImportRow[] };

export function FaqSection({ faqs, propertyName }: { faqs: Faq[]; propertyName?: string | null }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [nf, setNf] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState(false);
  const [packMsg, setPackMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);

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

  // Step 1: read the client's sheet and DRY-RUN it. Nothing is written — the owner
  // sees exactly what would be added vs overwritten (and any bad rows) first.
  async function pickImportFile(file: File) {
    setError(null);
    setPackMsg(null);
    setPreview(null);
    const csv = await file.text();
    setImporting(true);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "faqs", csv, dryRun: true }),
    });
    setImporting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Couldn't read that file. Is it the exported FAQ spreadsheet (saved as CSV)?");
      return;
    }
    const j = await res.json();
    setPreview({ csv, fileName: file.name, ...j.data });
  }

  // Step 2: apply for real, after the owner confirms the preview.
  async function applyImport() {
    if (!preview) return;
    const okToApply = await confirm({
      title: `Import ${preview.created + preview.updated} FAQ${preview.created + preview.updated === 1 ? "" : "s"}?`,
      message:
        `${preview.updated} existing answer${preview.updated === 1 ? "" : "s"} will be OVERWRITTEN and ${preview.created} new one${preview.created === 1 ? "" : "s"} added` +
        (propertyName ? `, for “${propertyName}”.` : ".") +
        " Nothing is deleted — if the sheet is wrong you can re-import a corrected one.",
      confirmLabel: "Import",
    });
    if (!okToApply) return;
    setImporting(true);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "faqs", csv: preview.csv, dryRun: false }),
    });
    setImporting(false);
    if (!res.ok) {
      setError("Import failed. Nothing was changed.");
      return;
    }
    const j = await res.json();
    setPreview(null);
    setPackMsg(`Imported: ${j.data.updated} updated, ${j.data.created} added${j.data.errors ? `, ${j.data.errors} row(s) skipped` : ""}.`);
    router.refresh();
  }

  async function loadStarterPack() {
    const okToLoad = await confirm({
      title: "Load the starter FAQ pack?",
      message:
        "Adds ~35 common traveller questions — pool, AC, hot water, location, food, payment, policies, safety and more — as HIDDEN drafts. They stay hidden from guests until you review each answer for your property and tap Show. Questions you already have are skipped.",
      confirmLabel: "Load drafts",
    });
    if (!okToLoad) return;
    setLoadingPack(true);
    setPackMsg(null);
    setError(null);
    const res = await fetch("/api/faq/starter", { method: "POST" });
    setLoadingPack(false);
    if (!res.ok) {
      setError("Couldn't load the starter pack. Please try again.");
      return;
    }
    const j = await res.json();
    const added: number = j.data?.added ?? 0;
    const skipped: number = j.data?.skipped ?? 0;
    setPackMsg(
      `Added ${added} hidden draft${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} you already have` : ""}. ` +
        "Review each below, edit the answer for your property, then tap Show to make it live.",
    );
    router.refresh();
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

      <div className="card card--pad" style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "var(--fs-small)" }}>New here? Load the starter pack</div>
          <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>
            ~35 common traveller questions added as hidden drafts for you to review and switch on.
          </div>
        </div>
        <button className="btn btn--ghost btn--sm" style={{ flex: "none" }} onClick={loadStarterPack} disabled={loadingPack}>
          {loadingPack ? "Loading…" : "Load starter pack"}
        </button>
      </div>

      <div className="card card--pad" style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "var(--fs-small)" }}>Send these to the property to fill in</div>
          <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>
            Downloads every question — live and hidden — as a spreadsheet (opens in Excel or Google Sheets).
          </div>
        </div>
        <a className="btn btn--ghost btn--sm" style={{ flex: "none" }} href="/api/faq/export.csv" download>
          Export to spreadsheet
        </a>
      </div>

      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "var(--fs-small)" }}>Upload the filled-in sheet</div>
            <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>
              Rows keep their <b>ID</b> to update an answer; leave the ID blank to add a new question.
              You&apos;ll see exactly what changes before anything is saved.
              {propertyName && <> Imports into <b>{propertyName}</b>.</>}
            </div>
          </div>
          <label className="btn btn--ghost btn--sm" style={{ flex: "none", cursor: "pointer" }}>
            {importing ? "Reading…" : "Choose CSV file"}
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickImportFile(f);
                e.target.value = ""; // allow re-picking the same file
              }}
            />
          </label>
        </div>

        {preview && (
          <div style={{ marginTop: 12, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
            <div style={{ fontWeight: 600, fontSize: "var(--fs-small)" }}>
              {preview.fileName} — nothing saved yet
            </div>
            <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <span className="badge badge--good">{preview.created} to add</span>
              <span className="badge badge--warn">{preview.updated} to overwrite</span>
              {preview.errors > 0 && <span className="badge badge--danger">{preview.errors} bad row{preview.errors === 1 ? "" : "s"}</span>}
            </div>

            {preview.errors > 0 && (
              <ul className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 8, paddingLeft: 18 }}>
                {preview.results
                  .filter((r) => r.status === "error")
                  .slice(0, 8)
                  .map((r) => (
                    <li key={r.row}>Row {r.row}: {r.message}</li>
                  ))}
              </ul>
            )}

            <div className="row" style={{ gap: 7, marginTop: 10 }}>
              <button
                className="btn btn--primary btn--sm"
                disabled={importing || preview.created + preview.updated === 0}
                onClick={applyImport}
              >
                {importing ? "Importing…" : `Import ${preview.created + preview.updated}`}
              </button>
              <button className="btn btn--ghost btn--sm" disabled={importing} onClick={() => setPreview(null)}>
                Cancel
              </button>
            </div>
            {preview.errors > 0 && (
              <p className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 8 }}>
                Bad rows are skipped — the good ones still import.
              </p>
            )}
          </div>
        )}
      </div>

      {packMsg && (
        <p style={{ fontSize: "var(--fs-small)", color: "var(--green-text)", marginTop: 0 }}>{packMsg}</p>
      )}

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
