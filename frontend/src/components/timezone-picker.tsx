import { useState } from "react"
import { Globe } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSetTimezone, useTimezone } from "@/hooks/use-api"
import { cn } from "@/lib/utils"

const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const TIMEZONES =
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [BROWSER_TIMEZONE]

export function TimezonePicker({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const { data } = useTimezone()
  const [tz, setTz] = useState(data?.timezone ?? BROWSER_TIMEZONE)
  const setTimezone = useSetTimezone()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && data) setTz(data.timezone)
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Timezone"
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-fg-dim transition-transform hover:scale-110 hover:text-fg-bright",
            className
          )}
        >
          <Globe className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Timezone</DialogTitle>
          <DialogDescription>
            Used for due dates, streaks, and the daily digest. The app's "day" runs 3am-3am in this
            timezone rather than midnight-midnight.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="timezone-select">Timezone</Label>
          <Select value={tz} onValueChange={setTz}>
            <SelectTrigger id="timezone-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            disabled={setTimezone.isPending || tz === data?.timezone}
            onClick={() =>
              setTimezone.mutate(tz, {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {setTimezone.isPending ? "Saving…" : "Save timezone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
