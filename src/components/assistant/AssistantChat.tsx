"use client";

import { useEffect, useRef, useState } from "react";
import { RenderComponent } from "@/components/assistant/registry";
import type { ChatMessage, StreamChunk } from "@/lib/assistant/types";

// The /assistant chat surface. Sends a message, reads the NDJSON stream from
// /api/assistant/message, and assembles each assistant turn (text + generative-UI
// components) as it arrives. Card buttons post structured slash-commands back
// through the same send() path — that's how the GenUI drives the conversation.

const SUGGESTIONS = [
  "What rooms are free 2026-08-01 to 2026-08-03?",
  "Help",
];

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "Namaste! 👋 Ask me what rooms are free for your dates, and I'll show you options with prices.", ui: [] },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // One id for the whole chat session so the agent keeps conversation memory
  // across turns (needed for the booking flow: gather details → confirm → OTP).
  const sessionRef = useRef<string>(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: message, ui: [] }, { role: "assistant", text: "", ui: [] }]);

    try {
      const res = await fetch("/api/assistant/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, sessionId: sessionRef.current }),
      });
      if (!res.ok || !res.body) throw new Error("no stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // Read NDJSON: one StreamChunk per line, applied to the last (assistant) message.
      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        finished = done;
        if (value) buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) applyChunk(JSON.parse(line) as StreamChunk);
        }
      }
    } catch {
      applyChunk({ type: "error", message: "I couldn't reach the assistant — please try again." });
    } finally {
      setBusy(false);
    }
  }

  function applyChunk(chunk: StreamChunk) {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last || last.role !== "assistant") return prev;
      if (chunk.type === "text") next[next.length - 1] = { ...last, text: last.text + chunk.delta };
      else if (chunk.type === "ui") next[next.length - 1] = { ...last, ui: [...last.ui, chunk.component] };
      else if (chunk.type === "error") next[next.length - 1] = { ...last, text: (last.text ? last.text + "\n\n" : "") + chunk.message };
      return next;
    });
  }

  return (
    <div className="col" style={{ height: "calc(100dvh - 160px)", minHeight: 420 }}>
      <div ref={scrollRef} className="col" style={{ gap: 14, overflowY: "auto", flex: 1, padding: "4px 2px 12px" }}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "row" : "col"} style={m.role === "user" ? { justifyContent: "flex-end" } : { gap: 2 }}>
            {m.role === "user" ? (
              <div style={{ background: "var(--accent-bg, var(--surface-2))", border: "1px solid var(--border)", borderRadius: 14, padding: "8px 12px", maxWidth: "82%", fontSize: "var(--fs-body)" }}>{m.text}</div>
            ) : (
              <div style={{ maxWidth: "92%" }}>
                {m.text && <div className="assistant-text" style={{ whiteSpace: "pre-wrap", fontSize: "var(--fs-body)", lineHeight: 1.5 }}>{renderText(m.text)}</div>}
                {m.ui.map((component, j) => (
                  <RenderComponent key={j} component={component} onAction={send} disabled={busy} />
                ))}
                {!m.text && m.ui.length === 0 && busy && i === messages.length - 1 && (
                  <div className="muted" style={{ fontSize: "var(--fs-small)" }}>…</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {messages.length <= 1 && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="btn btn--ghost btn--sm" onClick={() => send(s)} disabled={busy}>{s}</button>
          ))}
        </div>
      )}

      <form
        className="row"
        style={{ gap: 8, borderTop: "1px solid var(--border)", paddingTop: 10 }}
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Ask about rooms, dates, prices…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          aria-label="Message the assistant"
        />
        <button className="btn btn--primary" type="submit" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  );
}

// Minimal, safe inline formatting for the stub's **bold** / *italic* hints — no
// markdown dependency, no raw HTML. Phase 2 can swap in a proper renderer.
function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <b key={i}>{p.slice(2, -2)}</b>;
    if (p.startsWith("*") && p.endsWith("*")) return <i key={i}>{p.slice(1, -1)}</i>;
    return <span key={i}>{p}</span>;
  });
}
