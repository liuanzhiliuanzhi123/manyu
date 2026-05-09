import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AppPageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  label?: ReactNode
  trailing?: ReactNode
  className?: string
}

export function AppPageHeader({
  title,
  subtitle,
  label,
  trailing,
  className,
}: AppPageHeaderProps) {
  return (
    <header className={cn("flex items-start justify-between gap-3", className)}>
      <div className="space-y-1">
        {label ? <p className="app-label">{label}</p> : null}
        <h1 className="app-page-title">{title}</h1>
        {subtitle ? <p className="app-body">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </header>
  )
}
