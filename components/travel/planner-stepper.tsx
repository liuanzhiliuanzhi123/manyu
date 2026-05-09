"use client"

import { cn } from "@/lib/utils"

interface PlannerStepperProps {
  steps: string[]
  currentStep: number
  maxReachableStep: number
  onStepChange?: (step: number) => void
}

export function PlannerStepper({
  steps,
  currentStep,
  maxReachableStep,
  onStepChange,
}: PlannerStepperProps) {
  const progress = Math.max(0, Math.min(100, ((currentStep - 1) / Math.max(1, steps.length - 1)) * 100))

  return (
    <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-line)] bg-[var(--app-surface-elevated)] p-3.5">
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
        <div
          className="h-full rounded-full bg-[var(--app-brand)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const active = stepNumber === currentStep
          const done = stepNumber < currentStep
          const clickable = stepNumber <= maxReachableStep

          return (
            <button
              key={step}
              type="button"
              onClick={() => clickable && onStepChange?.(stepNumber)}
              disabled={!clickable}
              className={cn(
                "shrink-0 rounded-[var(--app-radius-sm)] border px-3 py-2 text-left transition-colors",
                active
                  ? "border-[var(--app-brand)] bg-[var(--app-brand)] text-white"
                  : done
                  ? "border-transparent bg-[var(--app-brand-soft)] text-[var(--app-brand)]"
                  : "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text-secondary)]",
                !clickable && "opacity-70"
              )}
            >
              <p className="numeric text-[11px] tracking-[0.04em]">STEP {stepNumber}</p>
              <p className="mt-0.5 text-xs font-medium">{step}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
