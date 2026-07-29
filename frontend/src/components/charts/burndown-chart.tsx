import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { BurndownPoint } from "@/api/types"

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-bg-alt px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-fg-dim">{formatDate(label)}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="tabular">
          {p.name}: {p.value ?? "—"}
        </p>
      ))}
    </div>
  )
}

export function BurndownChart({ data }: { data: BurndownPoint[] }) {
  return (
    <div className="h-64 sm:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff4444" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#ff4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#222222" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: "#666666", fontSize: 11 }}
            axisLine={{ stroke: "#222222" }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis tick={{ fill: "#666666", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#ff4444"
            strokeWidth={2}
            fill="url(#actualFill)"
            connectNulls
            isAnimationActive
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="ideal"
            name="Ideal pace"
            stroke="#7c4dff"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
