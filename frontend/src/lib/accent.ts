const STORAGE_KEY = "1337-accent-hue"

export const DEFAULT_ACCENT_HUE = 0

// Fixed saturation/lightness stops, tuned to match the original red palette
// (#cc2222 / #ff4444 / #8b0000) at hue 0 -- only the hue itself is picked by
// the user, lighter/darker shades fall out of these stops automatically.
export const ACCENT_STOPS = {
  dark: { s: 100, l: 27 },
  base: { s: 71, l: 47 },
  bright: { s: 100, l: 63 },
}

export const ACCENT_PRESETS = [
  { label: "Red", hue: 0 },
  { label: "Orange", hue: 25 },
  { label: "Amber", hue: 45 },
  { label: "Green", hue: 140 },
  { label: "Teal", hue: 180 },
  { label: "Blue", hue: 210 },
  { label: "Purple", hue: 265 },
  { label: "Pink", hue: 330 },
]

export function accentHsl(hue: number, stop: keyof typeof ACCENT_STOPS, alpha?: number) {
  const { s, l } = ACCENT_STOPS[stop]
  return alpha == null ? `hsl(${hue} ${s}% ${l}%)` : `hsl(${hue} ${s}% ${l}% / ${alpha})`
}

export function normalizeHue(hue: number): number {
  if (!Number.isFinite(hue)) return DEFAULT_ACCENT_HUE
  return ((hue % 360) + 360) % 360
}

export function loadAccentHue(): number {
  if (typeof window === "undefined") return DEFAULT_ACCENT_HUE
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return raw == null ? DEFAULT_ACCENT_HUE : normalizeHue(Number(raw))
}

export function saveAccentHue(hue: number): void {
  window.localStorage.setItem(STORAGE_KEY, String(normalizeHue(hue)))
}

export function applyAccentHue(hue: number): void {
  document.documentElement.style.setProperty("--accent-h", String(normalizeHue(hue)))
}
