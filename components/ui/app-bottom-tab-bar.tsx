import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AppBottomTabBarProps {
  children: ReactNode
  className?: string
}

export function AppBottomTabBar({ children, className }: AppBottomTabBarProps) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
      <div className="pointer-events-auto mx-auto w-full max-w-[430px]">
        <div className="border-t border-[var(--app-line)]/70 bg-[var(--app-surface-elevated)]/98 px-3 pt-2 shadow-[0_-10px_26px_rgba(41,52,27,0.06)] backdrop-blur-sm pb-[max(env(safe-area-inset-bottom),0px)]">
          <div className={cn(className)}>{children}</div>
        </div>
      </div>
    </nav>
  )
}
