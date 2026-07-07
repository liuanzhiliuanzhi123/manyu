export const PLANNER_ERROR_TYPES = [
  "none",
  "env_missing",
  "provider_400",
  "provider_401",
  "provider_402",
  "provider_403",
  "provider_404",
  "provider_408",
  "provider_422",
  "provider_429",
  "provider_500",
  "provider_502",
  "provider_503",
  "provider_timeout",
  "network_error",
  "invalid_json",
  "schema_validation_failed",
  "repair_failed",
  "fallback_used",
  "rate_limited",
  "unknown",
] as const

export type PlannerErrorType = (typeof PLANNER_ERROR_TYPES)[number]

const STATUS_TO_ERROR: Record<number, PlannerErrorType> = {
  400: "provider_400",
  401: "provider_401",
  402: "provider_402",
  403: "provider_403",
  404: "provider_404",
  408: "provider_408",
  422: "provider_422",
  429: "provider_429",
  500: "provider_500",
  502: "provider_502",
  503: "provider_503",
}

function toFiniteStatus(value: unknown) {
  const status = Number(value)
  return Number.isInteger(status) && status > 0 ? status : undefined
}

function classifyProviderStatus(status: number): PlannerErrorType {
  if (status < 400) return "none"
  if (STATUS_TO_ERROR[status]) return STATUS_TO_ERROR[status]
  if (status >= 500) return "provider_500"
  if (status >= 400) return "provider_400"
  return "unknown"
}

function getErrorRecord(error: unknown) {
  if (!error || typeof error !== "object") return undefined
  return error as {
    errorType?: unknown
    statusCode?: unknown
    status?: unknown
    name?: unknown
    message?: unknown
  }
}

export function classifyPlannerError(error?: unknown, providerStatus?: number): PlannerErrorType {
  const explicitStatus = toFiniteStatus(providerStatus)
  if (explicitStatus) return classifyProviderStatus(explicitStatus)

  if (!error) return "none"

  const record = getErrorRecord(error)
  const status = toFiniteStatus(record?.statusCode ?? record?.status)
  if (status) return classifyProviderStatus(status)

  const errorType = String(record?.errorType || "").toLowerCase()
  if (errorType === "missing_key") return "env_missing"
  if (errorType === "timeout") return "provider_timeout"
  if (errorType === "network") return "network_error"
  if (errorType === "http_status") return "unknown"
  if (errorType === "rate_limited") return "rate_limited"
  if (errorType === "invalid_json") return "invalid_json"
  if (errorType === "schema_validation" || errorType === "schema_validation_failed") {
    return "schema_validation_failed"
  }
  if (errorType === "repair_failed") return "repair_failed"
  if (errorType === "fallback_used") return "fallback_used"

  const name = String(record?.name || "").toLowerCase()
  const message = String(record?.message || "").toLowerCase()
  if (name === "aborterror" || message.includes("timed out") || message.includes("timeout")) {
    return "provider_timeout"
  }
  if (name === "zoderror" || message.includes("schema")) return "schema_validation_failed"
  if (message.includes("json parse") || message.includes("json object")) return "invalid_json"
  if (message.includes("repair failed")) return "repair_failed"
  if (message.includes("rate limit") || message.includes("rate_limited")) return "rate_limited"
  if (message.includes("network") || message.includes("fetch failed")) return "network_error"

  return "unknown"
}

export function getPlannerErrorRecommendation(errorType: PlannerErrorType) {
  switch (errorType) {
    case "provider_402":
      return "DeepSeek returned 402. Check account balance, billing status, or model access."
    case "provider_429":
      return "Provider rate limiting was observed. Reduce concurrency or add backoff."
    case "provider_timeout":
      return "Provider timeout was observed. Review timeout budget and prompt size."
    case "invalid_json":
      return "Invalid JSON was observed. Tighten response format constraints and repair logic."
    case "schema_validation_failed":
      return "Schema validation failed. Compare model output shape against planner schema."
    case "repair_failed":
      return "Repair failed. Review repair prompts and candidate pool quality."
    case "env_missing":
      return "Planner environment is missing a required provider key."
    default:
      return undefined
  }
}
