import type { AMapNamespace, AMapSecurityConfigWindow } from "@/lib/amap-types"

const CORE_PLUGINS = ["AMap.ToolBar", "AMap.Scale"]
const DEFAULT_PLUGINS = [
  ...CORE_PLUGINS,
  "AMap.Driving",
  "AMap.Walking",
  "AMap.Transfer",
  "AMap.Geocoder",
  "AMap.PlaceSearch",
  "AMap.Geolocation",
]

let amapInstancePromise: Promise<AMapNamespace> | null = null
const loadedPlugins = new Set<string>()

function getAMapKey() {
  return (
    process.env.NEXT_PUBLIC_AMAP_JS_KEY?.trim() ||
    process.env.NEXT_PUBLIC_AMAP_KEY?.trim() ||
    ""
  )
}

function getSecurityJsCode() {
  return process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE?.trim() || ""
}

function isPlaceholder(value: string) {
  const text = value.toUpperCase()
  return !value || text.includes("YOUR_AMAP") || text.includes("XXXX")
}

function setSecurityConfig() {
  if (typeof window === "undefined") return
  const securityJsCode = getSecurityJsCode()
  if (isPlaceholder(securityJsCode)) return

  const currentWindow = window as AMapSecurityConfigWindow
  currentWindow._AMapSecurityConfig = { securityJsCode }
}

function clearSecurityConfig() {
  if (typeof window === "undefined") return
  const currentWindow = window as AMapSecurityConfigWindow
  if ("_AMapSecurityConfig" in currentWindow) {
    delete currentWindow._AMapSecurityConfig
  }
}

function getErrorText(error: unknown) {
  if (!error) return ""
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (typeof error === "object") {
    const payload = error as Record<string, unknown>
    const parts = [payload.message, payload.info, payload.error, payload.infocode]
      .filter((item) => typeof item === "string")
      .map((item) => String(item))
    return parts.join(" ")
  }
  return String(error)
}

function isInvalidSecurityCodeError(error: unknown) {
  return getErrorText(error).toUpperCase().includes("INVALID_USER_SCODE")
}

function ensurePlugins(AMap: AMapNamespace, plugins: string[]) {
  const missingPlugins = plugins.filter((plugin) => !loadedPlugins.has(plugin))
  if (missingPlugins.length === 0) return Promise.resolve()

  return new Promise<void>((resolve) => {
    let settled = false
    const timeoutId = window.setTimeout(() => {
      if (settled) return
      settled = true
      resolve()
    }, 3000)

    try {
      AMap.plugin(missingPlugins, () => {
        if (settled) return
        settled = true
        window.clearTimeout(timeoutId)
        missingPlugins.forEach((plugin) => loadedPlugins.add(plugin))
        resolve()
      })
    } catch {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      resolve()
    }
  })
}

async function createAMapInstance(plugins: string[]) {
  const { default: AMapLoader } = await import("@amap/amap-jsapi-loader")
  return AMapLoader.load({
    key: getAMapKey(),
    version: "2.0",
    plugins,
  }) as Promise<AMapNamespace>
}

export async function loadAMap(plugins: string[] = DEFAULT_PLUGINS): Promise<AMapNamespace> {
  if (typeof window === "undefined") {
    throw new Error("高德地图仅支持在客户端加载")
  }

  const amapKey = getAMapKey()
  if (isPlaceholder(amapKey)) {
    throw new Error("未配置有效的高德 JS 地图 Key（NEXT_PUBLIC_AMAP_JS_KEY）")
  }

  const requestedPlugins = [...new Set([...CORE_PLUGINS, ...plugins])]

  if (!amapInstancePromise) {
    setSecurityConfig()
    amapInstancePromise = createAMapInstance(requestedPlugins).catch(async (error) => {
      if (isInvalidSecurityCodeError(error)) {
        clearSecurityConfig()
        try {
          return await createAMapInstance(requestedPlugins)
        } catch {
          // continue with core fallback
        }
      }

      try {
        return await createAMapInstance(CORE_PLUGINS)
      } catch {
        throw error
      }
    })
  }

  const AMap = await amapInstancePromise
  await ensurePlugins(AMap, requestedPlugins)
  return AMap
}

export function resetAMapLoader() {
  amapInstancePromise = null
  loadedPlugins.clear()
  clearSecurityConfig()
}

