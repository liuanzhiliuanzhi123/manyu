import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AppStatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  align?: "left" | "center"
  className?: string
}

export function AppStatCard({
  label,
  value,
  hint,
  icon,
  align = "center",
  className,
}: AppStatCardProps) {
  return (
    <article
      className={cn(
        "rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] px-3 py-2.5",
        align === "center" ? "text-center" : "text-left",
        className
      )}
    >
      {icon ? <div className={cn("mb-1 inline-flex", align === "center" ? "justify-center" : "justify-start")}>{icon}</div> : null}
      <p className="text-[10px] text-[var(--app-text-muted)]">{label}</p>
      <p className="numeric mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--app-text-secondary)]">{hint}</p> : null}
    </article>
  )
}
