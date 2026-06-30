/* redesign/screen-insights.jsx — Analytics (occupancy/ADR/RevPAR + source mix + trend)
   and Pricing (advisory rate suggestions). Both read DATA, same design system. */

function Delta({ v, invert }) {
  if (v == null) return null;
  const up = v > 0;
  const good = invert ? !up : up;
  return (
    <span style={{ fontSize: "var(--fs-micro)", fontWeight: 700, color: good ? "var(--green-text)" : "var(--amber-text)", display: "inline-flex", alignItems: "center", gap: 2 }}>
      <RDIcon name={up ? "arrowUp" : "arrowDown"} size={11} />{Math.abs(v)}%
    </span>
  );
}

function Analytics({ go }) {
  const a = DATA.analytics;
  const maxT = Math.max(...a.trend);
  const chMax = Math.max(...a.sourceMix.map((s) => s.pct));
  return (
    <div className="entrance">
      <div className="display" style={{ marginBottom: 6 }}>Analytics</div>
      <div className="pagehead__sub" style={{ marginBottom: 16 }}>{a.range} · occupancy, rate and source mix</div>

      <div className="kpi-strip" style={{ marginBottom: 18 }}>
        <div className="kpi-panel kpi-panel--verdict">
          <div className="kpi-eyebrow">Occupancy</div>
          <div className="kpi-num">{a.occupancy}%</div>
          <div className="kpi-ctx" style={{ display: "flex", gap: 6, alignItems: "center" }}><Delta v={a.occDelta} /> vs prior</div>
        </div>
        <div className="kpi-panel"><div className="kpi-eyebrow">ADR</div><div className="kpi-num">{DATA.money(a.adr)}</div><div className="kpi-ctx" style={{ display: "flex", gap: 6, alignItems: "center" }}><Delta v={a.adrDelta} /> avg rate</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">RevPAR</div><div className="kpi-num">{DATA.money(a.revpar)}</div><div className="kpi-ctx">per room</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Revenue</div><div className="kpi-num">{DATA.money(a.revenue)}</div><div className="kpi-ctx">30 days</div></div>
      </div>

      <div className="section-label"><div className="section-label__l"><span className="section-label__t">Occupancy trend</span><span className="section-label__c">14 days</span></div></div>
      <div className="card card--pad">
        <div className="trend">
          {a.trend.map((v, i) => (
            <div key={i} className="trend__bar" style={{ height: Math.round((v / maxT) * 100) + "%" }} title={v + "%"} />
          ))}
        </div>
      </div>

      <div className="section-label"><div className="section-label__l"><span className="section-label__t">Source mix</span></div></div>
      <div className="card card--pad">
        {a.sourceMix.map((s) => (
          <div key={s.ch} className="mixrow">
            <span className="mixrow__l">{s.ch}</span>
            <span className="mixrow__track"><span className="mixrow__fill" style={{ width: Math.round((s.pct / chMax) * 100) + "%" }} /></span>
            <span className="mixrow__v num">{s.pct}%</span>
          </div>
        ))}
      </div>

      <div className="section-label"><div className="section-label__l"><span className="section-label__t">By room type</span></div></div>
      <div className="card card--pad">
        {a.topTypes.map((t) => (
          <div key={t.name} className="mixrow">
            <span className="mixrow__l">{t.name}</span>
            <span className="mixrow__track"><span className="mixrow__fill" style={{ width: t.occ + "%" }} /></span>
            <span className="mixrow__v num">{t.occ}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pricing({ go }) {
  const p = DATA.pricing;
  const weekend = new Set([5, 6]); // Sat, Sun (Mon-indexed dows)
  const clampHi = { "Standard Double": 4000, "Deluxe": 5500, "Family Suite": 8000 };
  const suggest = (base, isWeekend) => {
    let r = base;
    if (isWeekend && p.enabled) r = Math.round(base * (1 + p.weekendPct / 100));
    return r;
  };
  return (
    <div className="entrance">
      <div className="display" style={{ marginBottom: 6 }}>Pricing</div>
      <div className="pagehead__sub" style={{ marginBottom: 14 }}>Advisory rates for the next 7 nights. Suggestions pre-fill new bookings — they’re never pushed to OTAs.</div>

      <a className="banner banner--good" onClick={() => go("settings")} style={{ marginBottom: 16 }}>
        <span className="banner__icon"><RDIcon name="tag" size={18} /></span>
        <span className="banner__txt">Rules: weekend +{p.weekendPct}% · {p.enabled ? "engine on" : "engine off"}</span>
        <span className="banner__arrow"><RDIcon name="arrowR" size={17} /></span>
      </a>

      {DATA.roomTypes.map((t) => (
        <div key={t.id} className="card card--pad" style={{ marginBottom: 12 }}>
          <div className="spread" style={{ marginBottom: 12 }}>
            <div>
              <div className="h3">{t.name}</div>
              <div className="field-hint" style={{ marginTop: 2 }}>Base {DATA.money(t.base)} · {t.rooms} room{t.rooms === 1 ? "" : "s"}</div>
            </div>
            <StatusBadge kind="paid">Floor–ceiling {DATA.money(t.floor)}–{DATA.money(clampHi[t.name] || t.ceiling)}</StatusBadge>
          </div>
          <div className="rate-strip">
            {DATA.dows.map((d, i) => {
              const we = weekend.has(i);
              const r = suggest(t.base, we);
              return (
                <div key={i} className={"rate-cell" + (we ? " rate-cell--we" : "")}>
                  <span className="rate-cell__d">{d}</span>
                  <span className="rate-cell__r num">{(r / 1000).toFixed(r % 1000 ? 1 : 0)}k</span>
                  {we && <span className="rate-cell__tag">+{p.weekendPct}%</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="section-label"><div className="section-label__l"><span className="section-label__t">Seasons in effect</span><span className="section-label__c">{DATA.seasons.length}</span></div><a className="section-label__a" onClick={() => go("settings")}>Edit rules <RDIcon name="arrowR" size={13} /></a></div>
      {DATA.seasons.map((s) => (
        <div key={s.name} className="rowcard">
          <div className="rowcard__main">
            <div className="rowcard__name" style={{ fontSize: "var(--fs-small)" }}>{s.name}</div>
            <div className="rowcard__meta">{s.from} → {s.to}</div>
          </div>
          <StatusBadge kind={s.pct >= 0 ? "warn" : "paid"}>{(s.pct > 0 ? "+" : "") + s.pct + "%"}</StatusBadge>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Analytics, Pricing });
