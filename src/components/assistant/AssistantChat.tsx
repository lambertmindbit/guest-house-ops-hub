"use client";

import { useEffect, useRef, useState } from "react";
import { RenderComponent } from "@/components/assistant/registry";
import type { ChatMessage, StreamChunk, UIComponent } from "@/lib/assistant/types";

// The chat surface. Sends a message, reads the NDJSON stream, and assembles each
// assistant turn (text + generative-UI components) as it arrives. Card buttons post
// structured slash-commands back through send() — that's how the GenUI drives the
// conversation.
//
// Two variants:
//   "chat"    — the guest widget: cards inline in the conversation.
//   "console" — the owner console. On a wide screen the generated cards lift out of
//               the transcript into a WORKSPACE column, with the conversation docked
//               beside it (you read a chart, you don't scroll a chat log for it). On
//               a phone there's no room for two panes, so it falls back to inline —
//               which is also the better shape for a thumb.

const SUGGESTIONS = ["What rooms are free 2026-08-01 to 2026-08-03?", "Help"];

// Mobile-first: assume narrow until the browser tells us otherwise, so SSR and the
// first client render agree.
function useIsWide(min = 1024) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${min}px)`);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [min]);
  return wide;
}

export function AssistantChat({
  endpoint = "/api/assistant/message",
  intro = "Namaste! 👋 Ask me what rooms are free for your dates, and I'll show you options with prices.",
  suggestions = SUGGESTIONS,
  variant = "chat",
  emptyTitle = "What do you want to know?",
  emptySub = "Ask about today, your revenue, or what needs your attention. I'll build the answer.",
  placeholder = "Ask about rooms, dates, prices…",
}: {
  endpoint?: string;
  intro?: string;
  suggestions?: string[];
  variant?: "chat" | "console";
  emptyTitle?: string;
  emptySub?: string;
  placeholder?: string;
} = {}) {
  const isConsole = variant === "console";
  const wide = useIsWide();
  const workspace = isConsole && wide; // two-pane only when there's room for it

  const [messages, setMessages] = useState<ChatMessage[]>(
    isConsole ? [] : [{ role: "assistant", text: intro, ui: [] }],
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // One id per session so the agent keeps memory across turns (the booking flow
  // needs it: gather details → confirm → OTP).
  const sessionRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    canvasRef.current?.scrollTo({ top: canvasRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: message, ui: [] }, { role: "assistant", text: "", ui: [] }]);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, sessionId: sessionRef.current }),
      });
      if (!res.ok || !res.body) throw new Error("no stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        finished = done;
        if (value) buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          // Skip a malformed line rather than aborting the turn — one bad chunk (a
          // proxy keep-alive, a truncated frame) shouldn't discard a good reply.
          let chunk: StreamChunk;
          try {
            chunk = JSON.parse(line) as StreamChunk;
          } catch {
            continue;
          }
          applyChunk(chunk);
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
      else if (chunk.type === "error")
        next[next.length - 1] = { ...last, text: (last.text ? last.text + "\n\n" : "") + chunk.message };
      return next;
    });
  }

  const started = messages.some((m) => m.role === "user");
  const allCards: UIComponent[] = workspace ? messages.flatMap((m) => m.ui) : [];

  const composer = (
    <form
      className="console-composer"
      onSubmit={(e) => {
        e.preventDefault();
        send(input);
      }}
    >
      <input
        className="input"
        style={{ flex: 1 }}
        placeholder={started ? "Ask a follow-up…" : placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={busy}
        aria-label="Message the assistant"
      />
      <button className="btn btn--primary" type="submit" disabled={busy || !input.trim()}>
        Send
      </button>
    </form>
  );

  const chips = suggestions.length > 0 && (
    <div className="console-chips">
      {suggestions.map((s) => (
        <button key={s} className="chip" onClick={() => send(s)} disabled={busy} type="button">
          {s}
        </button>
      ))}
    </div>
  );

  // ── Empty state: an invitation, not a blank chat log ──────────────────────
  if (isConsole && !started) {
    return (
      <div className="console-hero">
        <div className="console-hero__mark" aria-hidden="true">✦</div>
        <h2 className="console-hero__title">{emptyTitle}</h2>
        <p className="console-hero__sub">{emptySub}</p>
        <div className="console-hero__box">{composer}</div>
        {chips}
      </div>
    );
  }

  const transcript = (
    <div ref={scrollRef} className="console-thread">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="console-msg console-msg--you">
            {m.text}
          </div>
        ) : (
          <div key={i} className="console-msg console-msg--ai">
            {m.text && <div className="assistant-text">{renderText(m.text)}</div>}
            {/* In workspace mode the cards live in the canvas, not the transcript. */}
            {!workspace && m.ui.map((component, j) => (
              <RenderComponent key={j} component={component} onAction={send} disabled={busy} />
            ))}
            {!m.text && m.ui.length === 0 && busy && i === messages.length - 1 && (
              <div className="console-thinking">
                <span /><span /><span />
                <em>Working on it…</em>
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );

  // ── Phone / guest widget: one column, cards inline ────────────────────────
  if (!workspace) {
    return (
      <div className="console-single">
        {transcript}
        {!started && chips}
        {composer}
      </div>
    );
  }

  // ── Desktop console: workspace canvas + docked conversation ───────────────
  return (
    <div className="console">
      <section className="console__canvas" ref={canvasRef} aria-label="Generated workspace">
        {allCards.length === 0 ? (
          <div className="console__placeholder">
            {busy ? "Building your workspace…" : "Answers with numbers or charts will appear here."}
          </div>
        ) : (
          allCards.map((component, j) => (
            <RenderComponent key={j} component={component} onAction={send} disabled={busy} />
          ))
        )}
      </section>

      <aside className="console__chat" aria-label="Conversation">
        <div className="console__chat-hd">Copilot</div>
        {transcript}
        {composer}
      </aside>
    </div>
  );
}

// Minimal, safe inline formatting for **bold** / *italic* — no markdown dependency,
// no raw HTML.
function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <b key={i}>{p.slice(2, -2)}</b>;
    if (p.startsWith("*") && p.endsWith("*")) return <i key={i}>{p.slice(1, -1)}</i>;
    return <span key={i}>{p}</span>;
  });
}
