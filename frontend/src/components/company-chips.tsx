import { useState } from "react"
import { Building2, ChevronUp, Plus, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCompanies, useTagProblemCompany, useUntagProblemCompany } from "@/hooks/use-api"
import type { Company } from "@/api/types"
import { cn } from "@/lib/utils"

const VISIBLE_COUNT = 3

export function CompanyChips({
  problemId,
  companies,
  editable = false,
  className,
}: {
  problemId: number
  companies: Company[]
  editable?: boolean
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const { data } = useCompanies()
  const tag = useTagProblemCompany()
  const untag = useUntagProblemCompany()

  if (companies.length === 0 && !editable) return null

  const tagged = new Set(companies.map((c) => c.id))
  const available = (data?.companies ?? []).filter((c) => !tagged.has(c.id))
  const hidden = companies.length - VISIBLE_COUNT

  if (!expanded) {
    return (
      <div className={cn("flex flex-wrap items-center gap-1 text-xs text-fg-dim", className)}>
        <Building2 className="size-3.5 shrink-0" />
        {companies.length === 0 ? (
          <button
            type="button"
            aria-label="Add company"
            onClick={() => setExpanded(true)}
            className="text-fg-dim hover:text-fg-bright"
          >
            <Plus className="size-3.5" />
          </button>
        ) : (
          <>
            {companies.slice(0, VISIBLE_COUNT).map((c, i) => (
              <span key={c.id}>
                {c.name}
                {i < Math.min(VISIBLE_COUNT, companies.length) - 1 && " ·"}
              </span>
            ))}
            {hidden > 0 ? (
              <button type="button" onClick={() => setExpanded(true)} className="text-fg-dim hover:text-fg-bright">
                +{hidden} more
              </button>
            ) : (
              editable && (
                <button
                  type="button"
                  aria-label="Edit companies"
                  onClick={() => setExpanded(true)}
                  className="text-fg-dim hover:text-fg-bright"
                >
                  <Plus className="size-3.5" />
                </button>
              )
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-xs text-fg-dim", className)}>
      <Building2 className="size-3.5 shrink-0" />
      {editable ? (
        <>
          {companies.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1 rounded-none border border-border bg-bg-alt px-2 py-0.5"
            >
              {c.name}
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                disabled={untag.isPending}
                onClick={() => untag.mutate({ problemId, companyId: c.id })}
                className="text-fg-dim hover:text-red-bright"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {available.length > 0 && (
            <Select
              value=""
              disabled={tag.isPending}
              onValueChange={(value) => tag.mutate({ problemId, companyId: Number(value) })}
            >
              <SelectTrigger className="h-6 w-auto gap-1 border-dashed px-2 py-0 text-xs">
                <SelectValue placeholder="+ Add company" />
              </SelectTrigger>
              <SelectContent>
                {available.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </>
      ) : (
        companies.map((c, i) => (
          <span key={c.id}>
            {c.name}
            {i < companies.length - 1 && " ·"}
          </span>
        ))
      )}
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="flex items-center gap-0.5 text-fg-dim hover:text-fg-bright"
      >
        <ChevronUp className="size-3" />
        Show less
      </button>
    </div>
  )
}
