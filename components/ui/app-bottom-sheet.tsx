import type { ReactNode } from "react"
import { ArrowLeft, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AppBottomSheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  showCloseButton?: boolean
  showBackButton?: boolean
  mode?: "bottom" | "full"
}

export function AppBottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
  bodyClassName,
  showCloseButton = true,
  showBackButton = false,
  mode = "bottom",
}: AppBottomSheetProps) {
  if (!open) return null

  const fullMode = mode === "full"

  return (
    <div className="fixed inset-0 z-[60] animate-fade-in">
      <button type="button" className="absolute inset-0 bg-black/42" onClick={onClose} />
      <div className="pointer-events-none relative mx-auto flex h-full w-full max-w-[430px] items-end">
        <section
          className={cn(
            "pointer-events-auto flex w-full flex-col overflow-hidden border border-[var(--app-line)] bg-[var(--app-surface-elevated)] shadow-[var(--app-shadow-lifted)] animate-slide-in-up",
            fullMode
              ? "h-[100svh] rounded-none"
              : "max-h-[90svh] rounded-t-[1.7rem]",
            className
          )}
        >
          {!fullMode && (
            <div className="flex justify-center pb-2 pt-3">
              <div className="h-1.5 w-12 rounded-full bg-[var(--app-line-strong)]" />
            </div>
          )}

          {(title || description || showCloseButton || showBackButton) && (
            <header className="sticky top-0 z-10 border-b border-[var(--app-line)] bg-[var(--app-surface-elevated)]/96 px-4 py-3 backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-1.5">
                  {showBackButton ? (
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-[0.7rem] p-1.5 text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-muted)]"
                      aria-label="返回"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  ) : null}
                  <div className="min-w-0">
                    {title ? <h2 className="truncate text-base font-semibold text-[var(--app-text-strong)]">{title}</h2> : null}
                    {description ? <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{description}</p> : null}
                  </div>
                </div>
                {showCloseButton ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-[0.7rem] p-1.5 text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-muted)]"
                    aria-label="关闭"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </header>
          )}

          <div
            className={cn(
              "overflow-y-auto px-4 pt-4",
              fullMode ? "h-full pb-[calc(env(safe-area-inset-bottom)+1.25rem)]" : "pb-5",
              bodyClassName
            )}
          >
            {children}
          </div>
        </section>
      </div>
    </div>
  )
}
