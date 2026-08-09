import { Tag, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCompanies, useTagProblemCompany, useUntagProblemCompany } from "@/hooks/use-api"
import type { Company } from "@/api/types"

export function CompanyTagEditor({ problemId, companies }: { problemId: number; companies: Company[] }) {
  const { data } = useCompanies()
  const tag = useTagProblemCompany()
  const untag = useUntagProblemCompany()

  const tagged = new Set(companies.map((c) => c.id))
  const available = (data?.companies ?? []).filter((c) => !tagged.has(c.id))

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-dim">
      <Tag className="size-3.5 shrink-0" />
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
      {available.length > 0 ? (
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
      ) : companies.length === 0 ? (
        <span>No companies yet -- add one from Manage companies</span>
      ) : null}
    </div>
  )
}
