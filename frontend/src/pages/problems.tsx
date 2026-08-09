import { useCallback, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Search } from "lucide-react"
import { useProblems } from "@/hooks/use-api"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ProblemRow } from "@/components/problem-row"
import { ManageCompaniesDialog } from "@/components/manage-companies-dialog"
import { AddProblemDialog } from "@/components/add-problem-dialog"
import { cn } from "@/lib/utils"

const POOLS = [
  { value: "core", label: "Core 150" },
  { value: "extra", label: "Extra" },
  { value: "custom", label: "Custom" },
  { value: "all", label: "All" },
]

export default function Problems() {
  const [pool, setPool] = useState("core")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { data, isLoading, isError } = useProblems(pool)
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const isSearching = search.trim() !== ""

  const grouped = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    const filtered = q
      ? data.problems.filter((p) => p.companies.some((c) => c.name.toLowerCase().includes(q)))
      : data.problems

    const map = new Map<string, typeof filtered>()
    for (const p of filtered) {
      const list = map.get(p.category) ?? []
      list.push(p)
      map.set(p.category, list)
    }
    return Array.from(map.entries())
  }, [data, search])

  const toggleCategory = useCallback((category: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }, [])

  const jumpToCategory = useCallback((category: string) => {
    setExpanded((prev) => new Set(prev).add(category))
    // Wait for the section to expand before scrolling to it.
    requestAnimationFrame(() => {
      sectionRefs.current.get(category)?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Problems</h1>
        <div className="flex gap-2">
          <ManageCompaniesDialog />
          <AddProblemDialog />
        </div>
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

      {data && grouped.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {grouped.map(([category, problems]) => {
              const mastered = problems.filter((p) => p.status === "mastered").length
              return (
                <button
                  key={category}
                  onClick={() => jumpToCategory(category)}
                  className="rounded-full border border-border bg-bg-alt/60 px-2.5 py-1 text-xs font-medium text-fg-dim transition-colors hover:border-red/40 hover:text-fg-bright"
                >
                  {category}
                  <span className="ml-1 tabular text-fg-dim/70">
                    {mastered}/{problems.length}
                  </span>
                </button>
              )
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() =>
              setExpanded((prev) =>
                prev.size === grouped.length ? new Set() : new Set(grouped.map(([category]) => category))
              )
            }
          >
            {expanded.size === grouped.length ? (
              <>
                <ChevronsDownUp className="size-3.5" />
                Collapse all
              </>
            ) : (
              <>
                <ChevronsUpDown className="size-3.5" />
                Expand all
              </>
            )}
          </Button>
        </div>
      )}

      {isLoading && <div className="h-64 animate-pulse rounded-xl bg-bg-alt" />}
      {isError && (
        <div className="rounded-lg border border-red/40 bg-red/10 p-4 text-red-bright">Failed to load problems.</div>
      )}

      {data &&
        grouped.map(([category, problems]) => {
          const mastered = problems.filter((p) => p.status === "mastered").length
          const isOpen = isSearching || expanded.has(category)
          return (
            <Card
              key={category}
              ref={(el) => {
                if (el) sectionRefs.current.set(category, el)
                else sectionRefs.current.delete(category)
              }}
            >
              <CardHeader>
                <button
                  className="font-display flex w-full items-center justify-between gap-3 text-left text-base font-semibold text-fg-bright sm:text-lg"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={isOpen}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown className={cn("size-4 shrink-0 text-fg-dim transition-transform", !isOpen && "-rotate-90")} />
                    <span className="truncate">{category}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular text-xs text-fg-dim">
                      {mastered}/{problems.length}
                    </span>
                    <Progress value={(mastered / problems.length) * 100} className="hidden w-16 sm:block" />
                  </span>
                </button>
              </CardHeader>
              {isOpen && (
                <CardContent className="flex flex-col gap-2">
                  {problems.map((p) => (
                    <ProblemRow key={p.id} problem={p} stageInfo={data.stage_info} editable />
                  ))}
                </CardContent>
              )}
            </Card>
          )
        })}

      {data && grouped.length === 0 && (
        <div className="rounded-lg border border-border bg-bg-alt/60 p-6 text-center text-fg-dim">
          {search.trim() ? "No problems match that filter." : "No problems in this pool yet."}
        </div>
      )}
    </div>
  )
}
