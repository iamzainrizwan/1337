import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { useProblems } from "@/hooks/use-api"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProblemRow } from "@/components/problem-row"
import { TagEditor } from "@/components/tag-editor"
import { AddProblemDialog } from "@/components/add-problem-dialog"

const POOLS = [
  { value: "core", label: "Core 150" },
  { value: "extra", label: "Extra" },
  { value: "custom", label: "Custom" },
  { value: "all", label: "All" },
]

export default function Problems() {
  const [pool, setPool] = useState("core")
  const [search, setSearch] = useState("")
  const { data, isLoading, isError } = useProblems(pool)

  const grouped = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    const filtered = q
      ? data.problems.filter((p) => (p.company_tags ?? "").toLowerCase().includes(q))
      : data.problems

    const map = new Map<string, typeof filtered>()
    for (const p of filtered) {
      const list = map.get(p.category) ?? []
      list.push(p)
      map.set(p.category, list)
    }
    return Array.from(map.entries())
  }, [data, search])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Problems</h1>
        <AddProblemDialog />
      </div>

      <Tabs value={pool} onValueChange={setPool}>
        <TabsList className="w-full sm:w-auto">
          {POOLS.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className="flex-1 sm:flex-none">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-dim" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by company tag (e.g. Google)"
          className="pl-9"
        />
      </div>

      {isLoading && <div className="h-64 animate-pulse rounded-xl bg-bg-alt" />}
      {isError && (
        <div className="rounded-lg border border-red/40 bg-red/10 p-4 text-red-bright">Failed to load problems.</div>
      )}

      {data &&
        grouped.map(([category, problems]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{category}</span>
                <span className="tabular text-xs text-fg-dim">{problems.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {problems.map((p) => (
                <div key={p.id} className="flex flex-col gap-2">
                  <ProblemRow problem={p} stageInfo={data.stage_info} />
                  <div className="px-3">
                    <TagEditor id={p.id} tags={p.company_tags} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

      {data && grouped.length === 0 && (
        <div className="rounded-lg border border-border bg-bg-alt/60 p-6 text-center text-fg-dim">
          No problems match that filter.
        </div>
      )}
    </div>
  )
}
