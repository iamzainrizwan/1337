import { useState } from "react"
import { Check, Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUpdateTags } from "@/hooks/use-api"

export function TagEditor({ id, tags }: { id: number; tags: string | null }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(tags ?? "")
  const update = useUpdateTags()

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(tags ?? "")
          setEditing(true)
        }}
        className="flex flex-wrap items-center gap-1 text-xs text-fg-dim hover:text-fg-bright transition-colors min-h-[28px]"
      >
        <Tag className="size-3.5" />
        {tags
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .map((t) => (
                <span key={t} className="rounded-none border border-border bg-bg-alt px-2 py-0.5">
                  {t}
                </span>
              ))
          : "Add company tags"}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Google, Meta, Amazon"
        className="h-8 text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            update.mutate({ id, company_tags: value }, { onSuccess: () => setEditing(false) })
          }
          if (e.key === "Escape") setEditing(false)
        }}
      />
      <Button
        size="icon"
        className="size-8"
        disabled={update.isPending}
        onClick={() => update.mutate({ id, company_tags: value }, { onSuccess: () => setEditing(false) })}
      >
        <Check className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(false)}>
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
