"use client"

import { useEffect, useState } from "react"

export function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.max(1, page)
  const safeSize = Math.max(1, pageSize)
  const start = 0
  const end = safePage * safeSize
  return items.slice(start, end)
}
