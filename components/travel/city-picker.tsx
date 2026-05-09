"use client"

import { Search } from "lucide-react"
import { AppCard } from "@/components/ui/app-card"
import { AppChip } from "@/components/ui/app-chip"
import { AppInput } from "@/components/ui/app-input"
import { AppTag } from "@/components/ui/app-tag"
import { getCitiesByProvince, RECOMMENDED_CITY_GROUPS } from "@/lib/planner-city-data"
import type { RecommendedCity } from "@/lib/planner-types"
import { cn } from "@/lib/utils"

interface CityPickerProps {
  province: string
  city: string
  cityTagline?: string
  citySearch: string
  onProvinceChange: (province: string) => void
  onCitySearchChange: (value: string) => void
  onSelectCity: (city: RecommendedCity) => void
}

export function CityPicker({
  province,
  city,
  cityTagline,
  citySearch,
  onProvinceChange,
  onCitySearchChange,
  onSelectCity,
}: CityPickerProps) {
  const provinces = RECOMMENDED_CITY_GROUPS.map((item) => item.province)
  const currentProvince = province || provinces[0] || ""
  const cities = getCitiesByProvince(currentProvince)

  const filteredCities = citySearch.trim()
    ? cities.filter((item) =>
        `${item.city}${item.tagline}${(item.displayTags ?? item.tags).join("")}`
          .toLowerCase()
          .includes(citySearch.toLowerCase())
      )
    : cities

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[var(--app-text-strong)]">目的地选择</h3>
        <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
          先选省份，再选城市，路线会按城市范围优先聚合。
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {provinces.map((item) => (
          <AppChip key={item} type="button" selected={item === currentProvince} onClick={() => onProvinceChange(item)}>
            {item}
          </AppChip>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
        <AppInput
          type="text"
          value={citySearch}
          onChange={(event) => onCitySearchChange(event.target.value)}
          placeholder="搜索城市关键词，如亲子、美食、慢游"
          className="pl-9"
          tone="subtle"
        />
      </div>

      <div className="space-y-2">
        {filteredCities.map((item) => (
          <AppCard
            key={`${item.province}-${item.city}`}
            tone={city === item.city ? "elevated" : "default"}
            padding="md"
            interactive
            className={cn(
              "cursor-pointer",
              city === item.city && "border-[var(--app-brand)] bg-[var(--app-brand-soft)]/55"
            )}
            onClick={() => onSelectCity(item)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--app-text-strong)]">{item.city}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">{item.tagline}</p>
              </div>
              {city === item.city && <AppTag tone="brand">已选择</AppTag>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(item.displayTags ?? item.tags).slice(0, 3).map((tag) => (
                <AppTag key={tag}>{tag}</AppTag>
              ))}
            </div>
          </AppCard>
        ))}
      </div>

      {city && (
        <div className="rounded-[var(--app-radius-sm)] bg-[var(--app-brand-soft)] px-3 py-2 text-xs text-[var(--brand-deep)]">
          已选目的地：{currentProvince} · {city}
          {cityTagline ? `（${cityTagline}）` : ""}
        </div>
      )}
    </section>
  )
}
