export type LocationErrorCode =
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  | "insecure-context"
  | "unknown"

export interface SafePosition {
  lng: number
  lat: number
  accuracy: number
}

export class SafeLocationError extends Error {
  code: LocationErrorCode

  constructor(code: LocationErrorCode, message: string) {
    super(message)
    this.name = "SafeLocationError"
    this.code = code
  }
}

function normalizePositionError(error: unknown): SafeLocationError {
  const payload = (error ?? {}) as { code?: number; message?: string }
  const rawMessage = String(payload.message || "").toLowerCase()

  if (payload.code === 1 || rawMessage.includes("permission")) {
    return new SafeLocationError(
      "denied",
      "定位权限被拒绝，请在浏览器中允许定位权限"
    )
  }

  if (
    rawMessage.includes("secure origins") ||
    rawMessage.includes("only secure") ||
    rawMessage.includes("https")
  ) {
    return new SafeLocationError(
      "insecure-context",
      "定位仅支持 HTTPS 或 localhost"
    )
  }

  if (payload.code === 2 || rawMessage.includes("unavailable")) {
    return new SafeLocationError(
      "unavailable",
      "定位服务暂不可用，请检查系统定位服务和网络"
    )
  }

  if (payload.code === 3 || rawMessage.includes("timeout")) {
    return new SafeLocationError("timeout", "定位超时，请稍后重试")
  }

  return new SafeLocationError("unknown", "定位失败，请稍后重试")
}

function getCurrentPositionRaw(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(
        new SafeLocationError("unsupported", "当前浏览器不支持定位能力")
      )
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

export async function getCurrentPositionSafe(): Promise<SafePosition> {
  const attempts: PositionOptions[] = [
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    },
    {
      enableHighAccuracy: false,
      timeout: 18000,
      maximumAge: 30000,
    },
  ]

  let lastError: SafeLocationError | null = null

  for (const options of attempts) {
    try {
      const position = await getCurrentPositionRaw(options)
      return {
        lng: position.coords.longitude,
        lat: position.coords.latitude,
        accuracy: position.coords.accuracy,
      }
    } catch (error) {
      const normalized = normalizePositionError(error)
      lastError = normalized

      if (
        normalized.code === "denied" ||
        normalized.code === "unsupported" ||
        normalized.code === "insecure-context"
      ) {
        throw normalized
      }
    }
  }

  throw lastError || new SafeLocationError("unknown", "定位失败，请稍后重试")
}

export function getSafeLocationErrorMessage(error: unknown) {
  if (error instanceof SafeLocationError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return "定位失败，请稍后重试"
}

