import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const appIconButtonVariants = cva(
  "btn-press inline-flex items-center justify-center rounded-[var(--app-radius-sm)] border transition-[background-color,border-color,color,box-shadow,transform] duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-brand)]/24",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-[var(--app-brand)] text-[var(--primary-foreground)] shadow-[0_6px_14px_rgba(51,69,31,0.2)] hover:bg-[var(--app-brand-hover)]",
        secondary:
          "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text-primary)] hover:border-[var(--app-line-strong)]",
        ghost:
          "border-transparent bg-transparent text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text-strong)]",
        danger:
          "border-transparent bg-[var(--app-error)] text-white hover:brightness-95",
      },
      size: {
        sm: "h-8 w-8",
        md: "h-9 w-9",
        lg: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
)

function AppIconButton({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof appIconButtonVariants>) {
  return <button className={cn(appIconButtonVariants({ variant, size, className }))} {...props} />
}

export { AppIconButton, appIconButtonVariants }
