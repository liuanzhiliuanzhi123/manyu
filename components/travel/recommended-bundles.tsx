"use client"

import { CheckCircle2, Clock3, DollarSign, Layers3 } from "lucide-react"
import { AppTag } from "@/components/ui/app-tag"
import type { PoiBundle } from "@/lib/planner-types"
import { cn } from "@/lib/utils"

interface RecommendedBundlesProps {
  bundles: PoiBundle[]
  onAddBundle: (bundle: PoiBundle) => void
  isBundleAdded?: (bundle: PoiBundle) => boolean
}

export function RecommendedBundles({
  bundles,
  onAddBundle,
  isBundleAdded,
}: RecommendedBundlesProps) {
  if (bundles.length === 0) {
    return (
      <section className="space-y-2">
        <div>
          <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">经典组合包</h4>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">没想好去哪时可以直接一键加入。</p>
        </div>
        <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-3 text-xs text-[var(--app-text-secondary)]">
          当前城市暂无现成组合，下一步会按偏好自动补齐。
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-2">
      <div>
        <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">经典组合包</h4>
        <p className="mt-1 text-xs text-[var(--app-text-secondary)]">不知道怎么选时，直接一键加入整组路线。</p>
      </div>

      <div className="space-y-2">
        {bundles.map((bundle) => {
          const added = isBundleAdded?.(bundle) ?? false

          return (
            <article
              key={bundle.id}
              className="rounded-[var(--app-radius-sm)] border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h5 className="text-sm font-semibold text-[var(--app-text-strong)]">{bundle.title}</h5>
                  <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">{bundle.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onAddBundle(bundle)}
                  disabled={added}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-[0.65rem] px-2.5 py-1.5 text-xs font-medium transition-colors",
                    added
                      ? "bg-[var(--app-brand-soft)] text-[var(--app-brand)]"
                      : "bg-[var(--app-brand)] text-white hover:bg-[var(--brand-deep)]"
                  )}
                >
                  {added ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已加入
                    </>
                  ) : (
                    "一键加入"
                  )}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {bundle.tags.slice(0, 4).map((tag) => (
                  <AppTag key={tag}>{tag}</AppTag>
                ))}
              </div>

              <div className="numeric mt-2 grid grid-cols-3 gap-2 text-[11px] text-[var(--app-text-secondary)]">
                <div className="inline-flex items-center gap-1 rounded-[0.65rem] bg-[var(--app-surface-elevated)] px-2 py-1.5">
                  <Layers3 className="h-3 w-3" />
                  {bundle.poiIds.length} 个点
                </div>
                <div className="inline-flex items-center gap-1 rounded-[0.65rem] bg-[var(--app-surface-elevated)] px-2 py-1.5">
                  <Clock3 className="h-3 w-3" />
                  约 {bundle.estimatedHours || "-"} 小时
                </div>
                <div className="inline-flex items-center gap-1 rounded-[0.65rem] bg-[var(--app-surface-elevated)] px-2 py-1.5">
                  <DollarSign className="h-3 w-3" />
                  约 ¥{bundle.estimatedBudget || "-"}
                </div>
              </div>

              {bundle.reason && (
                <p className="mt-2 text-[11px] leading-5 text-[var(--app-brand)]/90">适合原因：{bundle.reason}</p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
