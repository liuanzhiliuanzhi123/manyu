"use client"

import { BedDouble, MapPin, Star, UtensilsCrossed } from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import type { DaySuggestionItem } from "@/lib/travel-context"
import { cn } from "@/lib/utils"

interface ResultLifestyleCardProps {
  title: string
  item: DaySuggestionItem | null | undefined
  emptyText: string
  tone?: "meal" | "hotel"
  onAction?: () => void
  actionText?: string
}

function getItemTypeLabel(item: DaySuggestionItem) {
  if (item.type === "hotel") return "住宿"
  const hitTag = (item.tags || []).find((tag) => /菜|餐|风味|小吃|烤|火锅|咖啡/u.test(tag))
  return hitTag || "餐饮"
}

export function ResultLifestyleCard({
  title,
  item,
  emptyText,
  tone = "meal",
  onAction,
  actionText,
}: ResultLifestyleCardProps) {
  const Icon = tone === "hotel" ? BedDouble : UtensilsCrossed

  if (!item) {
    return (
      <article className="rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-3">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--app-text-primary)]">
          <Icon className="h-3.5 w-3.5 text-[var(--app-brand)]" />
          {title}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">{emptyText}</p>
        {onAction && (
          <AppButton type="button" size="sm" variant="secondary" className="mt-2" onClick={onAction}>
            补充建议
          </AppButton>
        )}
      </article>
    )
  }

  return (
    <article
      className={cn(
        "rounded-[var(--app-radius-md)] border px-3 py-3",
        tone === "hotel"
          ? "border-[var(--app-line)] bg-[var(--app-surface)]"
          : "border-[var(--app-line)] bg-[var(--app-surface)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--app-text-primary)]">
            <Icon className="h-3.5 w-3.5 text-[var(--app-brand)]" />
            {title}
          </p>
          <h5 className="mt-1 truncate text-sm font-semibold text-[var(--app-text-strong)]">{item.name}</h5>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--app-text-secondary)]">
            <MapPin className="h-3.5 w-3.5" />
            {item.address}
          </p>
        </div>
        <span className="rounded-full bg-[var(--app-surface-elevated)] px-2 py-0.5 text-[10px] text-[var(--app-text-secondary)]">
          {getItemTypeLabel(item)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="numeric rounded-full bg-[var(--app-surface-elevated)] px-2 py-1 text-[var(--app-text-secondary)]">
          参考价 ¥{Math.round(item.price || 0)}
        </span>
        <span className="numeric inline-flex items-center gap-1 rounded-full bg-[var(--app-surface-elevated)] px-2 py-1 text-[var(--app-text-secondary)]">
          <Star className="h-3.5 w-3.5 text-[var(--app-gold)]" />
          {item.rating.toFixed(1)}
        </span>
        {(item.tags || []).slice(0, 2).map((tag) => (
          <span key={tag} className="rounded-full bg-[var(--app-surface-elevated)] px-2 py-1 text-[var(--app-text-secondary)]">
            {tag}
          </span>
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-5 text-[var(--app-text-secondary)]">{item.reason}</p>

      {onAction && (
        <AppButton type="button" size="sm" variant="secondary" className="mt-2" onClick={onAction}>
          {actionText || "查看详情"}
        </AppButton>
      )}
    </article>
  )
}
