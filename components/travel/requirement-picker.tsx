"use client"

import { AppChip } from "@/components/ui/app-chip"
import {
  BUDGET_OPTIONS,
  COMPANION_OPTIONS,
  INTEREST_OPTIONS,
  PACE_OPTIONS,
  SPECIAL_NEED_OPTIONS,
  TRAVEL_DAY_OPTIONS,
  type TravelRequirement,
} from "@/lib/planner-types"
import { cn } from "@/lib/utils"

interface RequirementPickerProps {
  requirement: TravelRequirement
  onChange: (next: TravelRequirement) => void
}

function toggleListValue(values: string[], value: string) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value)
  }
  return [...values, value]
}

export function RequirementPicker({ requirement, onChange }: RequirementPickerProps) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--app-text-strong)]">偏好与预算设置</h3>
        <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
          根据你的旅行方式填写条件，AI 会平衡路线、节奏和预算。
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--app-text-primary)]">出行天数</p>
        <div className="grid grid-cols-5 gap-2">
          {TRAVEL_DAY_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...requirement, days: value })}
              className={cn(
                "rounded-[var(--app-radius-sm)] border px-2 py-2 text-xs",
                requirement.days === value
                  ? "border-[var(--app-brand)] bg-[var(--app-brand)] text-white"
                  : "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text-secondary)]"
              )}
            >
              {value === 5 ? "5天+" : `${value}天`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--app-text-primary)]">预算范围</p>
        <div className="grid grid-cols-2 gap-2">
          {BUDGET_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange({ ...requirement, budgetRange: item })}
              className={cn(
                "rounded-[var(--app-radius-sm)] border px-3 py-2 text-left text-xs",
                requirement.budgetRange === item
                  ? "border-[var(--app-brand)] bg-[var(--app-brand-soft)] text-[var(--brand-deep)]"
                  : "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text-secondary)]"
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--app-text-primary)]">同行人群</p>
        <div className="grid grid-cols-2 gap-2">
          {COMPANION_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange({ ...requirement, companions: item.id })}
              className={cn(
                "rounded-[var(--app-radius-sm)] border px-3 py-2 text-left text-xs",
                requirement.companions === item.id
                  ? "border-[var(--app-brand)] bg-[var(--app-brand-soft)] text-[var(--brand-deep)]"
                  : "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text-secondary)]"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--app-text-primary)]">兴趣偏好（可多选）</p>
        <div className="flex flex-wrap gap-1.5">
          {INTEREST_OPTIONS.map((item) => (
            <AppChip
              key={item}
              type="button"
              selected={requirement.interests.includes(item)}
              onClick={() =>
                onChange({
                  ...requirement,
                  interests: toggleListValue(requirement.interests, item),
                })
              }
            >
              {item}
            </AppChip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--app-text-primary)]">旅行节奏</p>
        <div className="space-y-2">
          {PACE_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange({ ...requirement, pace: item.id })}
              className={cn(
                "w-full rounded-[var(--app-radius-sm)] border px-3 py-2.5 text-left",
                requirement.pace === item.id
                  ? "border-[var(--app-brand)] bg-[var(--app-brand-soft)]/65"
                  : "border-[var(--app-line)] bg-[var(--app-surface)]"
              )}
            >
              <p className="text-sm font-medium text-[var(--app-text-primary)]">{item.label}</p>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{item.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--app-text-primary)]">特殊需求（可多选）</p>
        <div className="flex flex-wrap gap-1.5">
          {SPECIAL_NEED_OPTIONS.map((item) => (
            <AppChip
              key={item}
              type="button"
              selected={(requirement.specialNeeds || []).includes(item)}
              onClick={() =>
                onChange({
                  ...requirement,
                  specialNeeds: toggleListValue(requirement.specialNeeds || [], item),
                })
              }
            >
              {item}
            </AppChip>
          ))}
        </div>
      </div>
    </section>
  )
}
