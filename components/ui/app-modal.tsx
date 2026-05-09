import type { ReactNode } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AppModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function AppModal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  bodyClassName,
}: AppModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] animate-fade-in">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="pointer-events-none relative mx-auto flex h-full w-full max-w-[430px] items-center justify-center p-4">
        <section
          className={cn(
            "pointer-events-auto w-full rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] shadow-[var(--app-shadow-lifted)]",
            className
          )}
        >
          {(title || description) && (
            <header className="flex items-start justify-between gap-3 border-b border-[var(--app-line)] px-4 py-3">
              <div>
                {title ? <h2 className="text-base font-semibold text-[var(--app-text-strong)]">{title}</h2> : null}
                {description ? <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[0.7rem] p-1.5 text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-muted)]"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
          )}
          <div className={cn("max-h-[70vh] overflow-y-auto px-4 py-4", bodyClassName)}>{children}</div>
        </section>
      </div>
    </div>
  )
}
