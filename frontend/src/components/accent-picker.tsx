import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT_HUE,
  accentHsl,
  applyAccentHue,
  loadAccentHue,
  saveAccentHue,
} from "@/lib/accent"

export function AccentPicker({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [hue, setHue] = useState(loadAccentHue)

  function pick(next: number) {
    setHue(next)
    applyAccentHue(next)
    saveAccentHue(next)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setHue(loadAccentHue())
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Accent color"
          className={cn(
            "size-7 shrink-0 rounded-full border border-border transition-transform hover:scale-110",
            className
          )}
          style={{ background: accentHsl(hue, "bright") }}
        />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accent color</DialogTitle>
          <DialogDescription>
            Pick a hue -- lighter and darker shades are calculated from it automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="accent-hue">Hue</Label>
            <input
              id="accent-hue"
              type="range"
              min={0}
              max={359}
              value={hue}
              onChange={(e) => pick(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-none border border-border"
              style={{
                background: `linear-gradient(to right, ${Array.from(
                  { length: 13 },
                  (_, i) => `hsl(${i * 30} 71% 47%)`
                ).join(", ")})`,
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            {(["dark", "base", "bright"] as const).map((stop) => (
              <div key={stop} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="h-10 w-full rounded-md border border-border"
                  style={{ background: accentHsl(hue, stop) }}
                />
                <span className="text-[11px] text-fg-dim capitalize">{stop}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Presets</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  title={preset.label}
                  onClick={() => pick(preset.hue)}
                  className={cn(
                    "size-8 rounded-full border-2 transition-transform hover:scale-110",
                    hue === preset.hue ? "border-fg-bright" : "border-transparent"
                  )}
                  style={{ background: accentHsl(preset.hue, "bright") }}
                />
              ))}
              <button
                type="button"
                title="Reset to default"
                onClick={() => pick(DEFAULT_ACCENT_HUE)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-dim hover:text-fg-bright hover:border-red/60 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
