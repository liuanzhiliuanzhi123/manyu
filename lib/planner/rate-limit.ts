export interface RateLimitOptions {
  limit: number
  windowMs: number
  now?: number
}

export interface RateLimitState {
  count: number
  resetAt: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

const plannerRateLimitStore = new Map<string, RateLimitState>()

export function checkRateLimit(
  store: Map<string, RateLimitState>,
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = options.now ?? Date.now()
  const limit = Math.max(1, options.limit)
  const windowMs = Math.max(1000, options.windowMs)
  const existing = store.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt,
    }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    }
  }

  existing.count += 1
  store.set(key, existing)
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  }
}

export function checkPlannerRateLimit(key: string) {
  // Vercel serverless memory is only a basic per-instance guard. Redis can replace this later.
  return checkRateLimit(plannerRateLimitStore, key, {
    limit: 5,
    windowMs: 60_000,
  })
}

export function clearPlannerRateLimitForTests() {
  plannerRateLimitStore.clear()
}
