"use client"

import type { ReactNode } from "react"
import { AppBottomSheet } from "@/components/ui/app-bottom-sheet"
import { cn } from "@/lib/utils"

interface ProfileSubpageProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  className?: string
  showBackButton?: boolean
}

export function ProfileSubpage({
  open,
  title,
  description,
  onClose,
  children,
  className,
  showBackButton = true,
}: ProfileSubpageProps) {
  return (
    <AppBottomSheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      mode="full"
      showBackButton={showBackButton}
      showCloseButton
      className={cn("bg-[var(--app-canvas)]", className)}
      bodyClassName="px-4"
    >
      {children}
    </AppBottomSheet>
  )
}
