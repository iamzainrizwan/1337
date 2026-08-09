import { useState } from "react"
import { Building2, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanies, useCreateCompany, useDeleteCompany } from "@/hooks/use-api"

export function ManageCompaniesDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const { data, isLoading } = useCompanies()
  const createCompany = useCreateCompany()
  const deleteCompany = useDeleteCompany()

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    createCompany.mutate(trimmed, { onSuccess: () => setName("") })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Building2 className="size-4" />
          Manage companies
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Companies</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a company (e.g. Google)"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit()
            }}
          />
          <Button size="sm" disabled={!name.trim() || createCompany.isPending} onClick={submit}>
            Add
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          {isLoading && <div className="text-sm text-fg-dim">Loading…</div>}
          {data?.companies.length === 0 && (
            <div className="text-sm text-fg-dim">No companies yet. Add one above.</div>
          )}
          {data?.companies.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-alt/60 px-3 py-2 text-sm"
            >
              <span className="text-fg-bright">{c.name}</span>
              <span className="flex items-center gap-2">
                <span className="tabular text-xs text-fg-dim">{c.problem_count ?? 0} problems</span>
                <button
                  type="button"
                  aria-label={`Delete ${c.name}`}
                  disabled={deleteCompany.isPending}
                  onClick={() => deleteCompany.mutate(c.id)}
                  className="text-fg-dim hover:text-red-bright"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
