"use client"

import type { ReactNode } from "react"
import { AppBottomSheet } from "@/components/ui/app-bottom-sheet"

interface MobileSheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  showCloseButton?: boolean
}

export function MobileSheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
  bodyClassName,
  showCloseButton = true,
}: MobileSheetProps) {
  return (
    <AppBottomSheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      className={className}
      bodyClassName={bodyClassName}
      showCloseButton={showCloseButton}
      mode="bottom"
    >
      {children}
    </AppBottomSheet>
  )
}
