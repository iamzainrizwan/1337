import { useState } from "react"
import { Settings2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSetGoal } from "@/hooks/use-api"
import type { Pacing } from "@/api/types"

export function GoalDialog({ pacing }: { pacing: Pacing }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(pacing.target_date)
  const setGoal = useSetGoal()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setDate(pacing.target_date)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="size-4" />
          Goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Goal target date</DialogTitle>
          <DialogDescription>
            Started {pacing.start_date}. All pacing math recomputes against this date.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="target-date">Target date</Label>
          <Input
            id="target-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={setGoal.isPending || !date}
            onClick={() =>
              setGoal.mutate(date, {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {setGoal.isPending ? "Saving…" : "Save target date"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
