"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { parseDateOnly } from "@/lib/dates";
import { displayINR } from "@/lib/format";
import type { RoomTypeRow, SourceRow, TrendPoint } from "@/lib/analytics";

// Recharts renders SVG, so CSS custom properties resolve against the current
// theme — passing "var(--accent)" keeps every chart light/dark + tint aware
// with no JS. The multi-slice donut needs distinct hues, so it gets a small
// fixed palette that reads on both grounds.
const SLICE = ["var(--accent)", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#64748b", "#0ea5e9", "#ec4899"];

const tick = { fill: "var(--text-subtle)", fontSize: 11 };
const tipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: 12,
};
const pct = (n: number) => `${Math.round(n)}%`;
const shortDate = (iso: string) => format(parseDateOnly(iso), "d MMM");

export function OccupancyTrendChart({ trend }: { trend: TrendPoint[] }) {
  // Absolute 0–100 scale — a flat-40% month reads as a flat line at 40%, not
  // bars normalised to their own max (the old CSS version was misleading).
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="occFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={tick}
          interval="preserveStartEnd"
          minTickGap={36}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={pct}
          tick={tick}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={tipStyle}
          labelFormatter={(d) => shortDate(String(d))}
          formatter={(v) => [pct(Number(v)), "Occupancy"]}
        />
        <Area type="monotone" dataKey="occupancyPct" stroke="var(--accent)" strokeWidth={2} fill="url(#occFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SourceMixChart({ sourceMix }: { sourceMix: SourceRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={sourceMix}
          dataKey="roomNights"
          nameKey="channel"
          innerRadius={52}
          outerRadius={82}
          paddingAngle={2}
          stroke="var(--surface)"
          strokeWidth={2}
        >
          {sourceMix.map((s, i) => (
            <Cell key={s.channel} fill={SLICE[i % SLICE.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tipStyle}
          formatter={(v, _n, p) => [`${Number(v)} room-nights · ${pct(p.payload.sharePct)}`, p.payload.channel]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RevenueByChannelChart({ sourceMix }: { sourceMix: SourceRow[] }) {
  // Highest-earning channel first — the owner's "where does the money come from"
  // view, distinct from the room-nights donut above (a low-volume channel can
  // still out-earn a high-volume one).
  const data = [...sourceMix].sort((a, b) => b.revenue - a.revenue);
  const h = Math.max(120, data.length * 44);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barSize={18}>
        <XAxis type="number" tickFormatter={(v) => displayINR(Number(v))} tick={tick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="channel" tick={tick} width={92} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tipStyle} cursor={{ fill: "var(--surface-3)" }} formatter={(v) => [displayINR(Number(v)), "Revenue"]} />
        <Bar dataKey="revenue" fill="var(--accent)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RoomTypeChart({ byRoomType }: { byRoomType: RoomTypeRow[] }) {
  const h = Math.max(120, byRoomType.length * 44);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={byRoomType} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barSize={18}>
        <XAxis type="number" domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={pct} tick={tick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={tick} width={92} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tipStyle} cursor={{ fill: "var(--surface-3)" }} formatter={(v) => [pct(Number(v)), "Occupancy"]} />
        <Bar dataKey="occupancyPct" fill="var(--accent)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
