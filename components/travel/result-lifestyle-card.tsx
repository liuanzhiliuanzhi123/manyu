"use client"

import { BedDouble, ChevronRight, MapPin, Star, UtensilsCrossed } from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import type { DaySuggestionItem } from "@/lib/travel-context"

interface ResultLifestyleCardProps {
  title: string
  item: DaySuggestionItem | null | undefined
  emptyText: string
  tone?: "meal" | "hotel"
  onAction?: () => void
  actionText?: string
}

function compactAddress(address: string) {
  const text = address.replace(/^北京市?/, "").trim()
  const district = text.match(
    /(东城区|西城区|朝阳区|海淀区|丰台区|石景山区|通州区|昌平区|大兴区|顺义区|房山区|门头沟区|怀柔区|密云区|延庆区|平谷区)/u
  )?.[1]
  if (!district) return text || "附近片区"

  const rest = text
    .replace(district, "")
    .replace(/[，,。；;].*$/u, "")
    .replace(/^\s*[·\-—｜|]?\s*/u, "")
    .trim()

  return rest ? `${district} · ${rest.slice(0, 10)}` : district
}

function getActionLabel(actionText?: string) {
  return actionText?.replace("午餐", "").replace("晚餐", "").replace("酒店", "") || "查看"
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
  const typeLabel = tone === "hotel" ? "酒店建议" : title
  const actionLabel = getActionLabel(actionText)

  if (!item) {
    return (
      <article className="rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-line)] bg-[var(--app-surface)] px-3.5 py-3 text-left">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--app-text-primary)]">{typeLabel}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">{emptyText}</p>
          </div>
        </div>
        {onAction && (
          <AppButton type="button" size="sm" variant="secondary" className="ml-12 mt-2.5" onClick={onAction}>
            补充建议
          </AppButton>
        )}
      </article>
    )
  }

  return (
    <article className="rounded-[var(--app-radius-md)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3.5 py-3 text-left">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-[var(--app-brand)]">{typeLabel}</p>
              <h5 className="mt-1 text-sm font-semibold leading-5 text-[var(--app-text-strong)]">{item.name}</h5>
            </div>
            {onAction && (
              <AppButton type="button" size="sm" variant="ghost" className="h-8 shrink-0 px-2" onClick={onAction}>
                {actionLabel}
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </AppButton>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[var(--app-text-secondary)]">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--app-brand)]" strokeWidth={1.7} />
              <span className="line-clamp-1">{compactAddress(item.address)}</span>
            </span>
            <span className="numeric">¥{Math.round(item.price || 0)}</span>
            <span className="numeric inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-[var(--app-gold)]" strokeWidth={1.7} />
              {item.rating.toFixed(1)}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[var(--app-text-secondary)]">{item.reason}</p>
        </div>
      </div>
    </article>
  )
}
