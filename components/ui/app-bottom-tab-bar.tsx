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
        <div className="border-t border-[var(--app-line)]/70 bg-[var(--app-surface-elevated)]/96 px-3 pt-2 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
          <div className={cn(className)}>{children}</div>
        </div>
      </div>
    </nav>
  )
}
