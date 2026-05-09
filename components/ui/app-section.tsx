import * as React from "react"
import { cn } from "@/lib/utils"

interface AppSectionProps extends React.ComponentProps<"section"> {
  title: string
  subtitle?: string
  action?: React.ReactNode
  contentClassName?: string
}

export function AppSection({
  title,
  subtitle,
  action,
  className,
  children,
  contentClassName,
  ...props
}: AppSectionProps) {
  return (
    <section className={cn("space-y-3", className)} {...props}>
      <header className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="app-section-title">{title}</h2>
          {subtitle ? (
            <p className="text-[0.78rem] leading-5 text-[var(--app-text-secondary)]">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("space-y-3", contentClassName)}>{children}</div>
    </section>
  )
}
