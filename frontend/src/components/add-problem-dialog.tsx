import { useState } from "react"
import { Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAddProblem } from "@/hooks/use-api"

const EMPTY = { name: "", url: "", category: "", difficulty: "Medium", company_tag: "" }

export function AddProblemDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const addProblem = useAddProblem()

  const canSubmit = form.name.trim() && form.url.trim() && form.category.trim()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setForm(EMPTY)
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Add problem
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a custom problem</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Merge K Sorted Lists"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-url">LeetCode URL</Label>
            <Input
              id="p-url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://leetcode.com/problems/..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-category">Category</Label>
            <Input
              id="p-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Heap / Priority Queue"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Difficulty</Label>
            <Select
              value={form.difficulty}
              onValueChange={(v) => setForm((f) => ({ ...f, difficulty: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-tag">Company tag (optional)</Label>
            <Input
              id="p-tag"
              value={form.company_tag}
              onChange={(e) => setForm((f) => ({ ...f, company_tag: e.target.value }))}
              placeholder="Google, Meta"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!canSubmit || addProblem.isPending}
            onClick={() =>
              addProblem.mutate(form, {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {addProblem.isPending ? "Adding…" : "Add problem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
