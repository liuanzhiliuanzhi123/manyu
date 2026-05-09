import { type ComponentType } from "react"
import { cn } from "@/lib/utils"

interface AppTabbarItem {
  id: string
  label: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  highlight?: boolean
  badge?: string | number | null
}

interface AppTabbarProps {
  items: AppTabbarItem[]
  activeId: string
  onChange: (id: string) => void
  iconStrokeWidth?: number
}

export function AppTabbar({
  items,
  activeId,
  onChange,
  iconStrokeWidth = 1.75,
}: AppTabbarProps) {
  return (
    <div className="glass rounded-[28px] border border-[var(--app-line)] px-1.5 py-1.5 shadow-[var(--app-shadow-medium)]">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon
          const active = item.id === activeId
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "relative flex min-w-0 flex-col items-center rounded-[16px] px-1 py-1.5 text-[10px] transition-all duration-200",
                active ? "text-[var(--app-brand)]" : "text-[var(--app-text-muted)]"
              )}
            >
              <span
                className={cn(
                  "mb-1 inline-flex items-center justify-center rounded-[13px] p-1.5 transition-all",
                  item.highlight
                    ? active
                      ? "bg-[var(--app-brand)] text-white shadow-[0_7px_14px_rgba(46,58,30,0.22)]"
                      : "bg-[var(--app-brand-soft)] text-[var(--app-brand)]"
                    : active
                    ? "bg-[var(--app-brand-soft)] text-[var(--app-brand)]"
                    : "bg-transparent text-current"
                )}
              >
                <Icon
                  className={cn(item.highlight ? "h-[1.15rem] w-[1.15rem]" : "h-[1.1rem] w-[1.1rem]")}
                  strokeWidth={iconStrokeWidth}
                />
              </span>
              <span className={cn("tracking-[0.01em]", active ? "font-semibold" : "font-medium")}>
                {item.label}
              </span>
              {item.badge ? (
                <span className="numeric absolute right-0.5 top-0 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--app-gold)] px-1.5 text-[9px] font-semibold text-white">
                  {item.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
