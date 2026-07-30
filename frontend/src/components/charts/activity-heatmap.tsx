import { useMemo } from "react"
import type { ActivityDay } from "@/api/types"
import { cn } from "@/lib/utils"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function levelForCount(count: number) {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 5) return 3
  return 4
}

const LEVEL_CLASSES = [
  "bg-bg-alt border border-border",
  "bg-crimson-dark/50 border border-crimson-dark/60",
  "bg-crimson-dark border border-crimson-dark",
  "bg-red border border-red",
  "bg-red-bright border border-red-bright shadow-[0_0_8px_hsl(var(--accent-h)_100%_63%_/_0.55)]",
]

export function ActivityHeatmap({ activity }: { activity: ActivityDay[] }) {
  const { weeks, monthMarkers } = useMemo(() => {
    if (activity.length === 0) return { weeks: [] as (ActivityDay | null)[][], monthMarkers: [] as { index: number; label: string }[] }

    const firstDate = new Date(activity[0].date + "T00:00:00")
    const leadingBlanks = firstDate.getDay() // 0=Sun

    const cells: (ActivityDay | null)[] = [
      ...Array.from({ length: leadingBlanks }, () => null),
      ...activity,
    ]
    while (cells.length % 7 !== 0) cells.push(null)

    const weeks: (ActivityDay | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7))
    }

    const monthMarkers: { index: number; label: string }[] = []
    let lastMonth = -1
    weeks.forEach((week, wi) => {
      const firstReal = week.find((d) => d)
      if (!firstReal) return
      const d = new Date(firstReal.date + "T00:00:00")
      if (d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth()
        monthMarkers.push({ index: wi, label: d.toLocaleDateString(undefined, { month: "short" }) })
      }
    })

    return { weeks, monthMarkers }
  }, [activity])

  return (
    <div className="scroll-thin overflow-x-auto pb-1">
      <div className="inline-flex flex-col gap-1 min-w-max">
        <div className="flex gap-[3px] pl-7 text-[10px] text-fg-dim">
          {weeks.map((_, wi) => {
            const marker = monthMarkers.find((m) => m.index === wi)
            return (
              <div key={wi} className="w-[13px]">
                {marker ? marker.label : ""}
              </div>
            )
          })}
        </div>
        <div className="flex gap-[3px]">
          <div className="flex flex-col gap-[3px] text-[10px] text-fg-dim pr-1 w-6">
            {DAY_LABELS.map((label, i) => (
              <div key={label} className="h-[13px] leading-[13px]">
                {i % 2 === 1 ? label.slice(0, 1) : ""}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <div
                  key={di}
                  title={day ? `${day.date}: ${day.count} review${day.count === 1 ? "" : "s"}` : undefined}
                  className={cn(
                    "size-[13px] rounded-none transition-transform hover:scale-125",
                    day ? LEVEL_CLASSES[levelForCount(day.count)] : "opacity-0"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pl-7 pt-1 text-[10px] text-fg-dim">
          <span>Less</span>
          {LEVEL_CLASSES.map((cls, i) => (
            <div key={i} className={cn("size-[10px] rounded-none", cls)} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
