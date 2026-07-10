"use client";

import { useEffect, useRef, useState } from "react";
import { displayINR, displayDMY } from "@/lib/format";
import type { UIComponent } from "@/lib/assistant/types";

// The generative-UI registry: maps an assistant-emitted descriptor { type, data }
// to a React component, built on the existing design system (card / btn / badge /
// tokens). The assistant "renders UI" by emitting these; adding a card type later
// is one case here + one type in lib/assistant/types.ts.

type Action = (message: string) => void;

export function RenderComponent({ component, onAction, disabled }: { component: UIComponent; onAction: Action; disabled: boolean }) {
  switch (component.type) {
    case "rooms":
      return <RoomsCards c={component} onAction={onAction} disabled={disabled} />;
    case "quote":
      return <QuoteCard c={component} onAction={onAction} disabled={disabled} />;
    case "booking_form":
      return <BookingFormCard c={component} onAction={onAction} disabled={disabled} />;
    case "confirm_booking":
      return <ConfirmCard c={component} onAction={onAction} disabled={disabled} />;
    case "otp":
      return <OtpCard c={component} onAction={onAction} disabled={disabled} />;
    case "faq_media":
      return <FaqMediaCard c={component} />;
    case "availability":
      return <AvailabilityCard c={component} />;
  }
}

function FaqMediaCard({ c }: { c: Extract<UIComponent, { type: "faq_media" }> }) {
  const { photos, mapLink, caption } = c.data;
  const hasPhotos = photos && photos.length > 0;
  if (!hasPhotos && !mapLink) return null;
  return (
    <div className="card card--pad" style={{ marginTop: 8, maxWidth: 360 }}>
      {caption && <div className="muted" style={{ fontSize: "var(--fs-meta)", marginBottom: 8 }}>{caption}</div>}
      {hasPhotos && (
        <div className="row" style={{ gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {photos!.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${src}-${i}`} src={src} alt="" loading="lazy"
              style={{ height: 128, width: "auto", borderRadius: 8, flex: "none", objectFit: "cover" }} />
          ))}
        </div>
      )}
      {mapLink && (
        <a href={mapLink} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm" style={{ marginTop: hasPhotos ? 10 : 0 }}>
          📍 View on map
        </a>
      )}
    </div>
  );
}

function RoomsCards({ c, onAction, disabled }: { c: Extract<UIComponent, { type: "rooms" }>; onAction: Action; disabled: boolean }) {
  const { data, checkIn, checkOut } = c;
  // Browse mode (list_rooms, no dates yet): the card is a photo gallery — there
  // is no valid /book target without dates, so no Book button is rendered.
  const bookable = Boolean(checkIn && checkOut);
  const [lightbox, setLightbox] = useState<{ roomId: string; index: number } | null>(null);
  const activeRoom = lightbox ? data.find((r) => r.id === lightbox.roomId) : null;
  const activePhotos = activeRoom?.photos ?? [];

  return (
    <div className="col" style={{ gap: 8, marginTop: 8 }}>
      {data.map((r) => {
        const photos = r.photos ?? [];
        const details = [r.facing, r.view].filter(Boolean).join(" · ");
        return (
          <div key={r.id} className="rowcard">
            {photos.length > 0 && (
              <button
                type="button"
                onClick={() => setLightbox({ roomId: r.id, index: 0 })}
                aria-label={`View photos of ${r.label}`}
                className="rowcard__lead"
                style={{ width: 52, height: 52, padding: 0, border: "none", cursor: "pointer", position: "relative", overflow: "hidden" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photos[0]} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                {photos.length > 1 && (
                  <span style={{ position: "absolute", right: 2, bottom: 2, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 9, fontWeight: 600, padding: "1px 4px", borderRadius: 99, lineHeight: 1.4 }}>
                    1/{photos.length}
                  </span>
                )}
              </button>
            )}
            <div className="rowcard__main">
              <div className="rowcard__name">{r.label} <span className="badge badge--neutral" style={{ marginLeft: 6 }}>{r.roomTypeName}</span></div>
              <div className="rowcard__meta">Sleeps {r.maxOccupancy} · <b className="num" style={{ color: "var(--ink)" }}>{displayINR(r.rate)}</b>/night</div>
              {details && <div className="rowcard__meta">{details}</div>}
              {r.amenities && r.amenities.length > 0 && <div className="rowcard__meta">{r.amenities.join(" · ")}</div>}
            </div>
            {bookable && (
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn--primary btn--sm" disabled={disabled} onClick={() => onAction(`/book ${r.id} ${checkIn} ${checkOut}`)}>Book</button>
              </div>
            )}
          </div>
        );
      })}
      {activeRoom && activePhotos.length > 0 && (
        <RoomLightbox
          photos={activePhotos}
          index={lightbox!.index}
          label={activeRoom.label}
          onIndex={(index) => setLightbox({ roomId: activeRoom.id, index })}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function RoomLightbox({ photos, index, label, onIndex, onClose }: { photos: string[]; index: number; label: string; onIndex: (i: number) => void; onClose: () => void }) {
  const prev = () => onIndex((index - 1 + photos.length) % photos.length);
  const next = () => onIndex((index + 1) % photos.length);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Keyboard support + focus management: Escape closes, arrows navigate; move
  // focus into the dialog on open and restore it on close. Without this a
  // keyboard/screen-reader user could open the gallery but never dismiss it.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowLeft" && photos.length > 1) prev();
      else if (e.key === "ArrowRight" && photos.length > 1) next();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
    // prev/next close over `index`; re-bind when it changes so arrows step correctly.
  }, [index, photos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${label}`}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#fff", fontSize: 28, lineHeight: 1, cursor: "pointer", padding: 6 }}>×</button>
      {photos.length > 1 && (
        <button type="button" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous photo" style={{ position: "absolute", left: 6, background: "none", border: "none", color: "#fff", fontSize: 32, cursor: "pointer", padding: 10 }}>‹</button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photos[index]} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "88vw", maxHeight: "78vh", objectFit: "contain", borderRadius: 6 }} />
      {photos.length > 1 && (
        <button type="button" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next photo" style={{ position: "absolute", right: 6, background: "none", border: "none", color: "#fff", fontSize: 32, cursor: "pointer", padding: 10 }}>›</button>
      )}
      {photos.length > 1 && (
        <span style={{ position: "absolute", bottom: 16, color: "#fff", fontSize: 12, fontFamily: "var(--font-mono, monospace)" }}>{index + 1} / {photos.length}</span>
      )}
    </div>
  );
}

function QuoteCard({ c, onAction, disabled }: { c: Extract<UIComponent, { type: "quote" }>; onAction: Action; disabled: boolean }) {
  const { data: q } = c;
  return (
    <div className="card card--pad" style={{ marginTop: 8, maxWidth: 340 }}>
      <div style={{ fontWeight: 600 }}>{q.roomLabel} <span className="muted" style={{ fontWeight: 400 }}>· {q.roomTypeName}</span></div>
      <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>{displayDMY(q.checkIn)} → {displayDMY(q.checkOut)} · {q.nights} night{q.nights === 1 ? "" : "s"}</div>
      <div className="spread" style={{ marginTop: 10, alignItems: "baseline" }}>
        <span className="muted" style={{ fontSize: "var(--fs-small)" }}>Total</span>
        <span className="num" style={{ fontSize: 22, fontWeight: 700 }}>{displayINR(q.total)}</span>
      </div>
      <button className="btn btn--primary btn--sm btn--block" style={{ marginTop: 10 }} disabled={disabled} onClick={() => onAction(`/book ${q.roomId} ${q.checkIn} ${q.checkOut}`)}>Book this room</button>
    </div>
  );
}

function BookingFormCard({ c, onAction, disabled }: { c: Extract<UIComponent, { type: "booking_form" }>; onAction: Action; disabled: boolean }) {
  const { data: b } = c;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const ready = name.trim().length > 0 && phone.length === 10;
  const submit = () => { if (ready) onAction(`/bookdetails ${b.roomId} ${b.checkIn} ${b.checkOut} ${phone} ${name.trim()}`); };
  return (
    <div className="card card--pad" style={{ marginTop: 8, maxWidth: 340 }}>
      <div style={{ fontWeight: 600 }}>{b.roomLabel} <span className="muted" style={{ fontWeight: 400 }}>· {b.roomTypeName}</span></div>
      <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>{displayDMY(b.checkIn)} → {displayDMY(b.checkOut)}</div>
      <div className="col" style={{ gap: 6, marginTop: 10 }}>
        <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} aria-label="Your name" />
        <input className="input" inputMode="numeric" placeholder="10-digit phone" value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          disabled={disabled} aria-label="Phone number" />
      </div>
      <div className="row" style={{ gap: 6, marginTop: 10 }}>
        <button className="btn btn--primary btn--sm" style={{ flex: 1 }} onClick={submit} disabled={disabled || !ready}>Continue</button>
        <button className="btn btn--ghost btn--sm" disabled={disabled} onClick={() => onAction("cancel")}>Not now</button>
      </div>
    </div>
  );
}

function ConfirmCard({ c, onAction, disabled }: { c: Extract<UIComponent, { type: "confirm_booking" }>; onAction: Action; disabled: boolean }) {
  const { data: b } = c;
  return (
    <div className="card card--pad" style={{ marginTop: 8, maxWidth: 360, borderColor: "var(--accent-border, var(--border))" }}>
      <div className="eyebrow eyebrow--accent">Confirm booking</div>
      <div style={{ fontWeight: 600, marginTop: 4 }}>{b.roomLabel} <span className="muted" style={{ fontWeight: 400 }}>· {b.roomTypeName}</span></div>
      {(b.guestName || b.guestPhone) && (
        <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>{[b.guestName, b.guestPhone].filter(Boolean).join(" · ")}</div>
      )}
      <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>{displayDMY(b.checkIn)} → {displayDMY(b.checkOut)} · {b.nights} night{b.nights === 1 ? "" : "s"}</div>
      <div className="spread" style={{ marginTop: 8, alignItems: "baseline" }}>
        <span className="muted" style={{ fontSize: "var(--fs-small)" }}>Total</span>
        <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{displayINR(b.total)}</span>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 12 }}>
        <button className="btn btn--primary btn--sm" style={{ flex: 1 }} disabled={disabled} onClick={() => onAction(`/confirm ${b.roomId} ${b.checkIn} ${b.checkOut}`)}>Confirm</button>
        <button className="btn btn--ghost btn--sm" disabled={disabled} onClick={() => onAction("cancel")}>Not now</button>
      </div>
    </div>
  );
}

function OtpCard({ c, onAction, disabled }: { c: Extract<UIComponent, { type: "otp" }>; onAction: Action; disabled: boolean }) {
  const [code, setCode] = useState("");
  const submit = () => { if (code.trim()) onAction(`/otp ${code.trim()}`); };
  return (
    <div className="card card--pad" style={{ marginTop: 8, maxWidth: 340 }}>
      <div className="eyebrow eyebrow--accent">Verify</div>
      <div style={{ fontSize: "var(--fs-small)", marginTop: 4 }}>{c.data.note}</div>
      {c.data.demoCode && (
        <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 4 }}>Demo code: <b className="num">{c.data.demoCode}</b> (normally sent by WhatsApp)</div>
      )}
      <div className="row" style={{ gap: 6, marginTop: 10 }}>
        <input className="input" inputMode="numeric" placeholder="Enter code" value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          disabled={disabled} style={{ flex: 1 }} aria-label="Verification code" />
        <button className="btn btn--primary btn--sm" onClick={submit} disabled={disabled || !code.trim()}>Verify</button>
      </div>
    </div>
  );
}

function AvailabilityCard({ c }: { c: Extract<UIComponent, { type: "availability" }> }) {
  const { data } = c;
  return (
    <div className="card card--pad" style={{ marginTop: 8, maxWidth: 360 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{data.roomTypeName}</div>
      <div className="col" style={{ gap: 3 }}>
        {data.nights.map((n) => (
          <div key={n.date} className="spread" style={{ fontSize: "var(--fs-small)" }}>
            <span className="muted">{displayDMY(n.date)}</span>
            <span className="num">{n.available} / {n.total} free</span>
          </div>
        ))}
      </div>
    </div>
  );
}
