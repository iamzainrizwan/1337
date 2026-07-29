import { Flame } from "lucide-react"
import { useStats } from "@/hooks/use-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ActivityHeatmap } from "@/components/charts/activity-heatmap"
import { BurndownChart } from "@/components/charts/burndown-chart"
import { DifficultyGauge } from "@/components/charts/difficulty-gauge"
import { AnimatedNumber } from "@/components/animated-number"

export default function Stats() {
  const { data, isLoading, isError } = useStats()

  if (isLoading) return <div className="h-96 animate-pulse rounded-xl bg-bg-alt" />
  if (isError || !data)
    return (
      <div className="rounded-lg border border-red/40 bg-red/10 p-4 text-red-bright">Failed to load stats.</div>
    )

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Stats</h1>

      <Card className="border-red/30">
        <CardContent className="flex items-center gap-4 p-5">
          <Flame className="size-9 text-red-bright drop-shadow-[0_0_10px_rgba(255,68,68,0.6)]" />
          <div>
            <AnimatedNumber value={data.streak} className="font-display text-3xl font-bold text-red-bright" />
            <p className="text-xs text-fg-dim">day streak</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity, last 13 weeks</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap activity={data.activity} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Burndown vs. ideal pace</CardTitle>
        </CardHeader>
        <CardContent>
          <BurndownChart data={data.burndown} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Difficulty breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <DifficultyGauge data={data.difficulty} />
        </CardContent>
      </Card>
    </div>
  )
}
