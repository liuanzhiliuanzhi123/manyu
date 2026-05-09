import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const appButtonVariants = cva(
  "btn-press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--app-radius-sm)] border border-transparent font-medium tracking-[0.01em] transition-[background-color,color,border-color,box-shadow,transform] duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-brand)]/22",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--app-brand)] text-[var(--primary-foreground)] shadow-[0_6px_14px_rgba(46,58,30,0.2)] hover:bg-[var(--app-brand-hover)] active:bg-[var(--app-brand-active)]",
        secondary:
          "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text-primary)] hover:border-[var(--app-line-strong)] hover:bg-[var(--app-surface-elevated)]",
        ghost:
          "bg-transparent text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text-strong)]",
        text:
          "bg-transparent text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text-strong)]",
        danger:
          "bg-[var(--app-error)] text-white shadow-[0_6px_14px_rgba(184,90,77,0.18)] hover:brightness-95",
      },
      size: {
        sm: "h-[2.15rem] px-3 text-[0.78rem]",
        md: "h-10 px-4 text-[0.88rem]",
        lg: "h-[2.95rem] px-5 text-[0.92rem]",
        icon: "h-10 w-10 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function AppButton({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof appButtonVariants>) {
  return <button className={cn(appButtonVariants({ variant, size, className }))} {...props} />
}

export { AppButton, appButtonVariants }
