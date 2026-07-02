"use client";

import { useRouter } from "next/navigation";
import type { DirectoryEntry } from "@/lib/community/directory";

// Filter chips update the URL; the server re-runs searchDirectory and re-renders
// the list. Read-only discovery — no writes here.
export function DirectoryClient({
  entries,
  needs,
  priceBands,
  activeNeeds,
  activePriceBand,
}: {
  entries: DirectoryEntry[];
  needs: string[];
  priceBands: string[];
  activeNeeds: string[];
  activePriceBand: string | null;
}) {
  const router = useRouter();

  function apply(nextNeeds: string[], nextPriceBand: string | null) {
    const params = new URLSearchParams();
    for (const n of nextNeeds) params.append("need", n);
    if (nextPriceBand) params.set("priceBand", nextPriceBand);
    const qs = params.toString();
    router.push(qs ? `/directory?${qs}` : "/directory");
  }

  function toggleNeed(need: string) {
    apply(activeNeeds.includes(need) ? activeNeeds.filter((n) => n !== need) : [...activeNeeds, need], activePriceBand);
  }
  function togglePriceBand(band: string) {
    apply(activeNeeds, activePriceBand === band ? null : band);
  }

  return (
    <div>
      {/* Need + price filters */}
      <div className="chips" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {needs.map((n) => (
          <button key={n} className={`chip${activeNeeds.includes(n) ? " on" : ""}`} onClick={() => toggleNeed(n)}>{n}</button>
        ))}
        {priceBands.map((b) => (
          <button key={b} className={`chip${activePriceBand === b ? " on" : ""}`} onClick={() => togglePriceBand(b)} style={{ textTransform: "capitalize" }}>{b}</button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="empty">No properties match. Try fewer filters, or ask peers to make their listing discoverable.</div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {entries.map((e) => (
            <div key={e.propertyId} className="card card--pad" style={{ padding: 14 }}>
              <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {e.name}
                    {e.connected && <span className="badge badge--good" style={{ marginLeft: 8 }}>Connected</span>}
                  </div>
                  {e.locality && <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>{e.locality}</div>}
                </div>
                {e.priceBand && <span className="badge badge--neutral" style={{ textTransform: "capitalize" }}>{e.priceBand}</span>}
              </div>

              {e.bio && <p style={{ fontSize: "var(--fs-small)", margin: "8px 0 0" }}>{e.bio}</p>}

              {e.amenities.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {e.amenities.map((a) => <span key={a} className="badge badge--neutral">{a}</span>)}
                </div>
              )}

              {/* Contact phone is revealed only once connected (Q7). */}
              <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 10 }}>
                {e.contactPhone
                  ? <>Contact: <a href={`tel:${e.contactPhone}`}>{e.contactPhone}</a></>
                  : "Connect in Settings › Trusted network to see contact details."}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
