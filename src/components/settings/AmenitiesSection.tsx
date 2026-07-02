"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

type Amenity = { id: string; name: string };
type RoomType = { id: string; name: string };

export function AmenitiesSection({
  amenities,
  roomTypes,
  byRoomType,
}: {
  amenities: Amenity[];
  roomTypes: RoomType[];
  byRoomType: Record<string, string[]>;
}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body: unknown, method = "POST") {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
  }

  return (
    <div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)" }}>{error}</p>}

      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" placeholder="Amenity (Wi-Fi, Parking, Meals, Pets, Wheelchair, Pickup…)" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn--primary btn--sm" disabled={!name.trim()} onClick={async () => { if (await call("/api/amenities", { name })) setName(""); }}>Add</button>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {amenities.map((a) => (
            <span key={a.id} className="badge badge--neutral" style={{ gap: 8 }}>
              {a.name}
              <button style={{ border: 0, background: "transparent", cursor: "pointer", color: "inherit" }}
                onClick={async () => { if (await confirm({ title: "Remove amenity", message: `Remove "${a.name}" everywhere?`, danger: true, confirmLabel: "Remove" })) call(`/api/amenities/${a.id}`, {}, "DELETE"); }} aria-label={`Remove ${a.name}`}>✕</button>
            </span>
          ))}
          {amenities.length === 0 && <span className="muted" style={{ fontSize: "var(--fs-small)" }}>No amenities yet.</span>}
        </div>
      </div>

      {amenities.length > 0 && roomTypes.map((rt) => {
        const have = new Set(byRoomType[rt.id] ?? []);
        return (
          <div key={rt.id} className="card card--pad" style={{ marginBottom: 10 }}>
            <div className="h3" style={{ marginBottom: 8 }}>{rt.name}</div>
            <div className="chips">
              {amenities.map((a) => {
                const on = have.has(a.id);
                return (
                  <button key={a.id} className={`chip${on ? " on" : ""}`}
                    onClick={() => call("/api/room-type-amenities", { roomTypeId: rt.id, amenityId: a.id, on: !on })}>
                    {a.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
