import { NavLink, Outlet } from "react-router-dom"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { AccentPicker } from "@/components/accent-picker"
import { NAV_ITEMS } from "./nav-items"

function Logo() {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="font-display text-xl font-bold tracking-tight text-fg-bright">
        13<span className="text-red-bright text-glow-red">3</span>7
      </span>
    </div>
  )
}

function DesktopSidebar() {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-bg-alt/60 md:px-4 md:py-6 md:gap-1">
      <div className="mb-8">
        <Logo />
        <p className="mt-1 px-1 text-xs text-fg-dim">Spaced-repetition tracker</p>
      </div>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-red/15 text-fg-bright shadow-[inset_0_0_0_1px_hsl(var(--accent-h)_71%_47%_/_0.4)]"
                : "text-fg-dim hover:bg-bg-alt hover:text-fg"
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
      <div className="mt-auto flex items-center gap-2 px-1 pt-4">
        <AccentPicker />
        <span className="text-xs text-fg-dim">Accent</span>
      </div>
    </aside>
  )
}

function MobileTopbar() {
  return (
    <header className="flex md:hidden items-center justify-between border-b border-border bg-bg-alt/80 px-4 py-3 sticky top-0 z-40 backdrop-blur">
      <Logo />
      <AccentPicker />
    </header>
  )
}

function MobileTabBar() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex md:hidden border-t border-border bg-bg-alt/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-[11px] font-medium transition-colors",
              isActive ? "text-red-bright" : "text-fg-dim"
            )
          }
        >
          {({ isActive }: { isActive: boolean }) => (
            <>
              <Icon className={cn("size-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--accent-h)_100%_63%_/_0.6)]")} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <DesktopSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <MobileTopbar />
        <motion.main
          className="flex-1 px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-8 max-w-6xl w-full mx-auto"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <Outlet />
        </motion.main>
      </div>
      <MobileTabBar />
    </div>
  )
}
