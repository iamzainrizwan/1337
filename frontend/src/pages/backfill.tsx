import { useState } from "react"
import { useBackfillCandidates, useBackfill } from "@/hooks/use-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DifficultyBadge } from "@/components/problem-badges"

const STAGE_OPTIONS = [
  { value: "0", label: "0 — First solve" },
  { value: "1", label: "1 — Day 1 review" },
  { value: "2", label: "2 — Week 1 review" },
  { value: "3", label: "3 — 3 Week review (mastered)" },
]

export default function Backfill() {
  const { data, isLoading, isError } = useBackfillCandidates()
  const backfill = useBackfill()

  const [problemId, setProblemId] = useState<string>("")
  const [completedDate, setCompletedDate] = useState<string>(data?.today ?? "")
  const [stage, setStage] = useState<string>("0")
  const [done, setDone] = useState(false)

  const selected = data?.problems.find((p) => String(p.id) === problemId)

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <h1 className="font-display text-2xl font-bold">Backfill a review</h1>
      <p className="text-sm text-fg-dim">
        Reconstruct progress for a problem you solved before this tracker existed, or record a review you
        completed outside the app.
      </p>

      {isLoading && <div className="h-64 animate-pulse rounded-xl bg-bg-alt" />}
      {isError && (
        <div className="rounded-lg border border-red/40 bg-red/10 p-4 text-red-bright">
          Failed to load backfill candidates.
        </div>
      )}

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Problem</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Not-yet-mastered problem</Label>
              <Select
                value={problemId}
                onValueChange={(v) => {
                  setProblemId(v)
                  setDone(false)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a problem" />
                </SelectTrigger>
                <SelectContent>
                  {data.problems.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && (
                <div className="flex items-center gap-2 pt-1 text-xs text-fg-dim">
                  <DifficultyBadge difficulty={selected.difficulty} />
                  <span>{selected.category}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="completed-date">Completed date</Label>
              <Input
                id="completed-date"
                type="date"
                value={completedDate || data.today}
                max={data.today}
                onChange={(e) => setCompletedDate(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Completed stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {done && (
              <p className="rounded-md border border-blue-bright/40 bg-blue-bright/10 px-3 py-2 text-sm text-blue-bright">
                Backfilled successfully.
              </p>
            )}

            <Button
              size="lg"
              disabled={!problemId || backfill.isPending}
              onClick={() =>
                backfill.mutate(
                  {
                    problem_id: Number(problemId),
                    completed_date: completedDate || data.today,
                    completed_stage: Number(stage),
                  },
                  {
                    onSuccess: () => {
                      setDone(true)
                      setProblemId("")
                    },
                  }
                )
              }
            >
              {backfill.isPending ? "Saving…" : "Backfill review"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
