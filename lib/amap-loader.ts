import type {
  AMapNamespace,
  AMapSecurityConfigWindow,
} from "@/lib/amap-types"

const BASE_PLUGINS = [
  "AMap.ToolBar",
  "AMap.Scale",
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
  return process.env.NEXT_PUBLIC_AMAP_KEY?.trim() || ""
}

function setSecurityConfig() {
  const securityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE?.trim()
  if (!securityJsCode || typeof window === "undefined") return
  if (
    securityJsCode.includes("YOUR_AMAP") ||
    securityJsCode.includes("你的") ||
    securityJsCode.includes("xxxx")
  ) {
    return
  }

  const currentWindow = window as AMapSecurityConfigWindow
  currentWindow._AMapSecurityConfig = { securityJsCode }
}

function ensurePlugins(AMap: AMapNamespace, plugins: string[]) {
  const missingPlugins = plugins.filter((plugin) => !loadedPlugins.has(plugin))
  if (missingPlugins.length === 0) return Promise.resolve()

  return new Promise<void>((resolve) => {
    AMap.plugin(missingPlugins, () => {
      missingPlugins.forEach((plugin) => loadedPlugins.add(plugin))
      resolve()
    })
  })
}

export async function loadAMap(
  plugins: string[] = BASE_PLUGINS
): Promise<AMapNamespace> {
  if (typeof window === "undefined") {
    throw new Error("高德地图仅支持在客户端加载")
  }

  const amapKey = getAMapKey()
  if (
    !amapKey ||
    amapKey.includes("YOUR_AMAP_WEB_KEY") ||
    amapKey.includes("你的高德")
  ) {
    throw new Error("未配置有效的高德地图 Key（NEXT_PUBLIC_AMAP_KEY）")
  }

  if (!amapInstancePromise) {
    setSecurityConfig()
    const { default: AMapLoader } = await import("@amap/amap-jsapi-loader")
    amapInstancePromise = AMapLoader.load({
      key: amapKey,
      version: "2.0",
      plugins: [...new Set([...BASE_PLUGINS, ...plugins])],
    }) as Promise<AMapNamespace>
  }

  const AMap = await amapInstancePromise
  await ensurePlugins(AMap, plugins)
  return AMap
}
