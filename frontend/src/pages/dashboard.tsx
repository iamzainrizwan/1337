import type { ReactNode } from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, ChevronDown, Flame } from "lucide-react"
import { useDashboard } from "@/hooks/use-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AnimatedNumber } from "@/components/animated-number"
import { ProblemRow } from "@/components/problem-row"
import { GoalDialog } from "@/components/goal-dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

function Skeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-40 animate-pulse rounded-xl bg-bg-alt" />
      <div className="h-32 animate-pulse rounded-xl bg-bg-alt" />
      <div className="h-64 animate-pulse rounded-xl bg-bg-alt" />
    </div>
  )
}

export default function Dashboard() {
  const { data, isLoading, isError, error } = useDashboard()

  if (isLoading) return <Skeleton />
  if (isError)
    return (
      <div className="rounded-lg border border-red/40 bg-red/10 p-4 text-red-bright">
        Failed to load dashboard: {(error as Error).message}
      </div>
    )
  if (!data) return null

  const { pacing, today_activity, streak, due, upcoming, suggested, categories, stage_info, today } = data

  const solvedToday = today_activity.filter((a) => a.outcome === "solved")
  const reviewedToday = today_activity.filter((a) => a.outcome !== "solved")

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="glow-red overflow-hidden border-red/30 bg-gradient-to-br from-bg-alt to-black">
          <CardContent className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="text-xs uppercase tracking-widest text-fg-dim">Today</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <div className="flex items-baseline gap-2">
                  <AnimatedNumber
                    value={solvedToday.length}
                    className="font-display text-4xl sm:text-5xl font-bold text-fg-bright"
                  />
                  <span className="text-fg-dim text-sm">solved for the first time</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <AnimatedNumber
                    value={reviewedToday.length}
                    className="font-display text-4xl sm:text-5xl font-bold text-fg-bright"
                  />
                  <span className="text-fg-dim text-sm">reviewed</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-fg-dim tabular">{today}</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-red/30 bg-red/10 px-5 py-4">
              <Flame className="size-8 text-red-bright drop-shadow-[0_0_10px_hsl(var(--accent-h)_100%_63%_/_0.6)]" />
              <div>
                <AnimatedNumber value={streak} className="font-display text-3xl font-bold text-red-bright" />
                <p className="text-xs text-fg-dim">day streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Progress: pacing stays visible (it surfaces the unrealistic-pace warning), category breakdown collapsed */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Pace to goal</CardTitle>
          <GoalDialog pacing={pacing} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(pacing.unrealistic || pacing.past_deadline) && (
            <div className="flex items-start gap-2 rounded-lg border border-red-bright/40 bg-red-bright/10 p-3 text-sm text-red-bright">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>
                {pacing.past_deadline
                  ? "You're past your target date. Consider pushing it back."
                  : `Unrealistic pace: ${pacing.required_rate_today.toFixed(1)} new problems/day required. Consider a later target date.`}
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Target date" value={pacing.target_date} mono />
            <Stat label="Days remaining" value={String(pacing.days_remaining)} />
            <Stat label="Required rate/day" value={pacing.required_rate_today.toFixed(1)} accent="red" />
            <Stat label="Unstarted (core)" value={String(pacing.remaining_unstarted)} />
          </div>
          <Progress
            value={(pacing.actual_weighted / Math.max(pacing.target_count * 4, 1)) * 100}
            indicatorClassName="bg-blue-bright"
          />
          <p className="text-xs text-fg-dim tabular">
            {pacing.actual_mastered} mastered &middot; {pacing.actual_started} started &middot; {pacing.target_count} core total
          </p>
        </CardContent>
      </Card>

      <CollapsibleSection title="Category progress" count={categories.length}>
        <div className="flex flex-col gap-4">
          {categories.map((c) => (
            <div key={c.category} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg">{c.category}</span>
                <span className="tabular text-fg-dim">
                  {c.mastered}/{c.total}
                </span>
              </div>
              <Progress value={(c.weighted / Math.max(c.total * 4, 1)) * 100} indicatorClassName="bg-purple" />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Reviews today */}
      <Section title={`Due today (${due.length})`} empty="Nothing due today. Clean slate.">
        {due.map((p) => (
          <ProblemRow key={p.id} problem={p} stageInfo={stage_info} today={today} />
        ))}
      </Section>

      {/* New problems */}
      {suggested.length > 0 && (
        <Section title="Suggested new problems">
          {suggested.map((p) => (
            <ProblemRow key={p.id} problem={p} stageInfo={stage_info} today={today} />
          ))}
        </Section>
      )}

      {/* Upcoming reviews: rarely needed, so it lives at the very bottom, collapsed */}
      <CollapsibleSection title="Upcoming reviews" count={upcoming.length}>
        {upcoming.length > 0 ? (
          upcoming.map((p) => <ProblemRow key={p.id} problem={p} stageInfo={stage_info} today={today} />)
        ) : (
          <Badge variant="outline">No upcoming reviews scheduled.</Badge>
        )}
      </CollapsibleSection>
    </div>
  )
}

function Stat({
  label,
  value,
  mono = false,
  accent,
}: {
  label: string
  value: string
  mono?: boolean
  accent?: "red"
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-bg-alt/50 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-fg-dim">{label}</span>
      <span
        className={
          mono
            ? "tabular text-sm text-fg-bright"
            : accent === "red"
              ? "font-display text-lg font-semibold text-red-bright"
              : "font-display text-lg font-semibold text-fg-bright"
        }
      >
        {value}
      </span>
    </div>
  )
}

function Section({
  title,
  children,
  empty,
}: {
  title: ReactNode
  children: ReactNode
  empty?: string
}) {
  const list = Array.isArray(children) ? children : [children]
  const hasContent = list.filter(Boolean).length > 0
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {hasContent ? children : <Badge variant="outline">{empty ?? "Nothing here."}</Badge>}
      </CardContent>
    </Card>
  )
}

function CollapsibleSection({
  title,
  count,
  children,
}: {
  title: ReactNode
  count: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <CardHeader>
        <button
          className="font-display flex w-full items-center justify-between gap-3 text-left text-base font-semibold text-fg-bright sm:text-lg"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="flex items-center gap-2">
            <ChevronDown className={cn("size-4 shrink-0 text-fg-dim transition-transform", !open && "-rotate-90")} />
            {title}
          </span>
          <span className="tabular text-xs text-fg-dim">{count}</span>
        </button>
      </CardHeader>
      {open && <CardContent className="flex flex-col gap-2">{children}</CardContent>}
    </Card>
  )
}
