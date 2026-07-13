"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartCardData } from "@/lib/assistant/types";

// Charts the OWNER console renders. Kept in its own module and lazy-loaded by the
// registry so Recharts never lands in the PUBLIC guest-chat bundle — a guest asking
// about the pool should not download a charting library.
//
// Recharts draws SVG, so CSS custom properties resolve against the live theme:
// passing var(--accent) keeps these light/dark + tint aware with no JS. (Recharts
// is pinned to 2.x — 3.x renders ResponsiveContainer at width:0 here.)

const tick = { fill: "var(--text-subtle)", fontSize: 11 };
const tipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--text)",
};

export function ChartCard({ data }: { data: ChartCardData }) {
  const prefix = data.valuePrefix ?? "";
  const fmt = (n: number) => `${prefix}${Math.round(n).toLocaleString("en-IN")}`;
  // Compact axis labels: ₹22,000 -> ₹22k, so long rupee figures don't crowd out
  // the plot on a phone.
  const axisFmt = (n: number) => (n >= 1000 ? `${prefix}${Math.round(n / 1000)}k` : `${prefix}${n}`);

  return (
    <div className="card card--pad console-card">
      <div className="console-card__hd">
        <div>
          <div className="console-card__title">{data.title}</div>
          {data.subtitle && <div className="console-card__sub">{data.subtitle}</div>}
        </div>
        <span className="muted" style={{ fontSize: "var(--fs-meta)", flex: "none" }}>
          {data.points.length} {data.points.length === 1 ? "bar" : "bars"}
        </span>
      </div>

      <div style={{ width: "100%", height: 240, marginTop: 10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.points} margin={{ top: 6, right: 6, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={tick} axisLine={false} tickLine={false} width={48} tickFormatter={axisFmt} />
            <Tooltip
              contentStyle={tipStyle}
              cursor={{ fill: "var(--surface-2)" }}
              formatter={(v: number) => [fmt(v), ""]}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
              {data.points.map((p) => (
                <Cell key={p.label} fill="var(--accent)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
