import type { ComponentType } from "react"
import { Compass } from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"

interface EmptyStateCardProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: ComponentType<{ className?: string }>
}

export function EmptyStateCard({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Compass,
}: EmptyStateCardProps) {
  return (
    <AppCard tone="soft" padding="lg" className="text-left">
      <Icon className="mb-3 h-8 w-8 text-[var(--app-text-muted)]" />
      <p className="text-base font-semibold text-[var(--app-text-strong)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{description}</p>
      {actionLabel && onAction ? (
        <AppButton type="button" variant="secondary" className="mt-4" onClick={onAction}>
          {actionLabel}
        </AppButton>
      ) : null}
    </AppCard>
  )
}
