import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DifficultyBadge, StatusBadge } from "@/components/problem-badges"
import { CompanyChips } from "@/components/company-chips"
import { useReview, useSolve } from "@/hooks/use-api"
import type { Problem, StageInfo } from "@/api/types"
import { cn } from "@/lib/utils"

function stageLabel(stageInfo: StageInfo | undefined, stage: number | null | undefined) {
  if (!stageInfo || stage == null) return null
  return stageInfo[String(stage)]?.label ?? null
}

export function ProblemRow({
  problem,
  stageInfo,
  today,
  editable = false,
  className,
}: {
  problem: Problem
  stageInfo?: StageInfo
  today?: string
  editable?: boolean
  className?: string
}) {
  const solve = useSolve()
  const review = useReview()

  const status = problem.status ?? "not_started"
  const overdue = status === "reviewing" && !!problem.next_review_at && !!today && problem.next_review_at < today
  const label = stageLabel(stageInfo, problem.stage)

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-bg-alt/60 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <a
          href={problem.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 truncate font-medium text-fg-bright hover:text-red-bright transition-colors"
        >
          <span className="truncate">{problem.name}</span>
          <ExternalLink className="size-3.5 shrink-0 text-fg-dim" />
        </a>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-dim">
          <DifficultyBadge difficulty={problem.difficulty} />
          <StatusBadge status={status} overdue={overdue} />
          <span aria-hidden>&middot;</span>
          <span>{problem.category}</span>
          {label && status === "reviewing" && (
            <span className="tabular text-fg-dim">
              &middot; {label} &middot; {problem.next_review_at}
            </span>
          )}
        </div>
        <CompanyChips problemId={problem.id} companies={problem.companies} editable={editable} />
      </div>

      <div className="flex shrink-0 gap-2">
        {status === "not_started" && (
          <Button
            size="default"
            className="flex-1 sm:flex-none"
            disabled={solve.isPending}
            onClick={() => solve.mutate(problem.id)}
          >
            Solve
          </Button>
        )}
        {status === "reviewing" && (
          <>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: problem.id, action: "struggled" })}
            >
              Struggled
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: problem.id, action: "done" })}
            >
              Done
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
