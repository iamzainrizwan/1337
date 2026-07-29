import { LayoutDashboard, ListChecks, BarChart3, History, Mail } from "lucide-react"

export const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/problems", label: "Problems", icon: ListChecks },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/backfill", label: "Backfill", icon: History },
  { to: "/digest", label: "Digest", icon: Mail },
] as const
