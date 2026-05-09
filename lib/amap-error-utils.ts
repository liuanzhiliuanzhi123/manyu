export interface AMapErrorAnalysis {
  code: string | null
  userMessage: string
  shouldShowExternalFallback: boolean
}

const CODE_PATTERN =
  /(USERKEY_PLAT_NOMATCH|INVALID_USER_SCODE|INVALID_USER_KEY|SERVICE_NOT_AVAILABLE|DAILY_QUERY_OVER_LIMIT|USER_DAILY_QUERY_OVER_LIMIT|OVER_LIMIT|NO_ROADS_NEARBY|CITY_NOT_SUPPORT|TOO_FREQUENT|NO_DATA)/i

function normalizeText(input: string) {
  return input.trim().toUpperCase()
}

function pickCode(text: string) {
  const matched = text.match(CODE_PATTERN)
  return matched?.[1]?.toUpperCase() ?? null
}

function toMessage(errorLike: unknown) {
  if (typeof errorLike === "string") return errorLike
  if (errorLike instanceof Error) return errorLike.message
  if (typeof errorLike === "object" && errorLike) {
    const payload = errorLike as Record<string, unknown>
    const candidates = [payload.message, payload.info, payload.error, payload.infocode]
    return candidates
      .filter((item) => typeof item === "string")
      .map((item) => String(item))
      .join(" ")
  }
  return String(errorLike ?? "")
}

export function analyzeAmapError(
  errorLike: unknown,
  fallbackMessage = "路线规划失败，请稍后重试"
): AMapErrorAnalysis {
  const raw = toMessage(errorLike)
  const text = normalizeText(raw)
  const code = pickCode(text)

  if (text.includes("INVALID_USER_SCODE") && text.includes("USERKEY_PLAT_NOMATCH")) {
    return {
      code: "INVALID_USER_SCODE",
      userMessage:
        "高德配置存在两个问题：1）安全密钥错误（INVALID_USER_SCODE），请检查 NEXT_PUBLIC_AMAP_SECURITY_JS_CODE；2）Key 与当前域名不匹配（USERKEY_PLAT_NOMATCH），请在高德控制台把当前域名加入 Web 白名单。",
      shouldShowExternalFallback: true,
    }
  }

  if (text.includes("USERKEY_PLAT_NOMATCH")) {
    return {
      code: "USERKEY_PLAT_NOMATCH",
      userMessage:
        "高德 Key 与当前访问域名不匹配（USERKEY_PLAT_NOMATCH）。请在高德控制台将当前域名（如 localhost 或 127.0.0.1）加入 Web 白名单。",
      shouldShowExternalFallback: true,
    }
  }

  if (text.includes("INVALID_USER_SCODE")) {
    return {
      code: "INVALID_USER_SCODE",
      userMessage:
        "高德安全密钥配置错误（INVALID_USER_SCODE）。请检查 NEXT_PUBLIC_AMAP_SECURITY_JS_CODE；若暂未启用安全密钥，请删除该变量并重启项目。",
      shouldShowExternalFallback: true,
    }
  }

  if (text.includes("INVALID_USER_KEY")) {
    return {
      code: "INVALID_USER_KEY",
      userMessage:
        "高德 Key 无效，请检查 NEXT_PUBLIC_AMAP_JS_KEY（或兼容字段 NEXT_PUBLIC_AMAP_KEY）是否正确并已开通 JS API。",
      shouldShowExternalFallback: false,
    }
  }

  if (
    text.includes("DAILY_QUERY_OVER_LIMIT") ||
    text.includes("USER_DAILY_QUERY_OVER_LIMIT") ||
    text.includes("OVER_LIMIT")
  ) {
    return {
      code: "OVER_LIMIT",
      userMessage: "高德接口调用已超出配额，请稍后重试或更换可用 Key。",
      shouldShowExternalFallback: true,
    }
  }

  if (text.includes("SERVICE_NOT_AVAILABLE")) {
    return {
      code: "SERVICE_NOT_AVAILABLE",
      userMessage:
        "高德路线服务当前不可用，请确认 Key 已开通对应服务并检查控制台配置。",
      shouldShowExternalFallback: true,
    }
  }

  if (text.includes("NO_ROADS_NEARBY") || text.includes("NO_DATA")) {
    return {
      code: code ?? "NO_DATA",
      userMessage: "起点或终点附近没有可规划道路，请尝试切换地点或出行方式。",
      shouldShowExternalFallback: false,
    }
  }

  if (text.includes("CITY_NOT_SUPPORT")) {
    return {
      code: "CITY_NOT_SUPPORT",
      userMessage: "当前城市暂不支持稳定公交规划，请切换驾车或步行。",
      shouldShowExternalFallback: false,
    }
  }

  if (text.includes("TOO_FREQUENT")) {
    return {
      code: "TOO_FREQUENT",
      userMessage: "请求过于频繁，请稍后重试。",
      shouldShowExternalFallback: true,
    }
  }

  return {
    code,
    userMessage: fallbackMessage,
    shouldShowExternalFallback: false,
  }
}

