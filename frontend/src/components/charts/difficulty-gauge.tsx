import { useMemo } from "react"
import type { Difficulty, DifficultyBucket } from "@/api/types"

const COLORS: Record<string, { track: string; fill: string; text: string }> = {
  Easy: { track: "#3a6ea533", fill: "#5a9fd4", text: "#5a9fd4" },
  Medium: { track: "#7c4dff33", fill: "#a67cff", text: "#a67cff" },
  Hard: { track: "#cc222233", fill: "#ff4444", text: "#ff4444" },
}

const ORDER: Difficulty[] = ["Easy", "Medium", "Hard"]

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle)
  const end = polarToCartesian(cx, cy, r, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export function DifficultyGauge({ data }: { data: DifficultyBucket[] }) {
  const buckets = useMemo(() => {
    const byName = new Map(data.map((d) => [d.difficulty, d]))
    return ORDER.map((name) => byName.get(name) ?? { difficulty: name, total: 0, mastered: 0, started: 0 })
  }, [data])

  const grandTotal = buckets.reduce((s, b) => s + b.total, 0) || 1
  const cx = 150
  const cy = 140
  const outerR = 120
  const innerR = 92

  let angle = 0
  const segments = buckets.map((b) => {
    const width = (b.total / grandTotal) * 180
    const startAngle = angle
    const endAngle = angle + width
    angle = endAngle
    const ratio = b.started > 0 ? b.mastered / b.started : 0
    const fillEnd = startAngle + width * ratio
    return { ...b, startAngle, endAngle, fillEnd, width }
  })

  const masteredTotal = buckets.reduce((s, b) => s + b.mastered, 0)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 170" className="w-full max-w-xs">
        {segments.map((seg) => {
          const c = COLORS[seg.difficulty] ?? COLORS.Easy
          if (seg.width <= 0) return null
          return (
            <g key={seg.difficulty}>
              <path
                d={arcPath(cx, cy, outerR, seg.startAngle, seg.endAngle)}
                stroke={c.track}
                strokeWidth={innerR ? outerR - innerR : 20}
                fill="none"
                strokeLinecap="butt"
              />
              {seg.fillEnd > seg.startAngle && (
                <path
                  d={arcPath(cx, cy, outerR, seg.startAngle, seg.fillEnd)}
                  stroke={c.fill}
                  strokeWidth={outerR - innerR}
                  fill="none"
                  strokeLinecap="butt"
                  style={{ filter: `drop-shadow(0 0 6px ${c.fill}80)` }}
                />
              )}
            </g>
          )
        })}
        <text x={cx} y={cy - 24} textAnchor="middle" className="fill-fg-bright font-display" fontSize="30" fontWeight={700}>
          {masteredTotal}
        </text>
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-fg-dim" fontSize="11">
          mastered / {grandTotal}
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
        {segments.map((seg) => {
          const c = COLORS[seg.difficulty] ?? COLORS.Easy
          return (
            <div key={seg.difficulty} className="flex items-center gap-1.5 tabular">
              <span className="size-2.5 rounded-none" style={{ background: c.fill }} />
              <span className="text-fg-dim">{seg.difficulty}</span>
              <span style={{ color: c.text }}>
                {seg.mastered}/{seg.total}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
