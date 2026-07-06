import { fetchAmapPoiText } from "@/lib/amap/amap-poi-client"
import { classifyPoiRootCategory } from "@/lib/places/poi-classifier"
import { isBeijingPoi, isFormalPoi } from "@/lib/places/poi-filter"
import { buildPoiSubTags } from "@/lib/places/poi-subtagger"
import {
  ROOT_CATEGORY_LABELS,
  SUB_TAG_LABELS,
  type AmapPoiInput,
  type BeijingPoi,
  type BeijingPoiRootCategory,
} from "@/lib/places/poi-types"

export const BEIJING_POI_IMPORT_KEYWORDS: Record<BeijingPoiRootCategory, string[]> = {
  scenic: [
    "天安门",
    "故宫",
    "颐和园",
    "天坛",
    "长城",
    "北京景区",
    "北京公园",
    "北京博物馆",
    "北京胡同",
    "北京艺术区",
    "北京夜景",
    "北京亲子景点",
    "北京寺庙",
    "北京剧院",
  ],
  food: [
    "北京烤鸭",
    "北京菜",
    "北京小吃",
    "炸酱面",
    "北京火锅",
    "北京涮肉",
    "牛街美食",
    "北京咖啡",
    "北京甜品",
    "北京夜宵",
    "北京美食",
    "京味餐厅",
  ],
  hotel: [
    "北京五星酒店",
    "北京四星酒店",
    "北京经济型酒店",
    "北京商务酒店",
    "北京亲子酒店",
    "北京地铁酒店",
    "王府井酒店",
    "前门酒店",
    "国贸酒店",
    "西单酒店",
  ],
}

export interface PoiImporterOptions {
  apiKey?: string
  dryRun?: boolean
  pageLimit?: number
  offset?: number
  maxPerKeyword?: number
  delayMs?: number
  timeoutMs?: number
  keywords?: Partial<Record<BeijingPoiRootCategory, string[]>>
}

export interface PoiImportQuarantineItem {
  keyword: string
  requestedRoot: BeijingPoiRootCategory
  name: string
  type?: string
  typecode?: string
  reason: string
}

export interface PoiImportStats {
  dryRun: boolean
  endpoint: "amap:v3/place/text"
  keywordCount: number
  fetched: number
  accepted: number
  deduped: number
  quarantined: number
  withImage: number
  noImage: number
  byRoot: Record<BeijingPoiRootCategory, number>
}

export interface PoiImportResult {
  stats: PoiImportStats
  pois: BeijingPoi[]
  quarantine: PoiImportQuarantineItem[]
}

export interface NormalizedAmapPoiResult {
  poi?: BeijingPoi
  quarantine?: Omit<PoiImportQuarantineItem, "keyword">
}

function toText(value: unknown) {
  if (Array.isArray(value)) return value.join("")
  return String(value || "").trim()
}

function toNumber(value: unknown, fallback = 0) {
  const raw = String(value || "").replace(/[^\d.]/g, "")
  const numberValue = Number(raw)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function normalizeAddress(value: unknown) {
  const text = toText(value).replace(/\s+/g, "")
  return text || "北京市"
}

function parseLocation(location?: string) {
  const [lng, lat] = String(location || "")
    .split(",")
    .map((item) => Number(item.trim()))
  return {
    lng: Number.isFinite(lng) ? lng : undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
  }
}

function firstPhoto(poi: AmapPoiInput) {
  return poi.photos?.find((photo) => /^https?:\/\//iu.test(photo.url || ""))
}

function hashText(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(36)
}

function makePoiId(poi: AmapPoiInput, rootCategory: BeijingPoiRootCategory) {
  if (poi.id) return `amap-${poi.id}`
  const key = [rootCategory, poi.name, toText(poi.address), poi.location].join("|")
  return `amap-${rootCategory}-${hashText(key)}`
}

function dedupeKey(poi: BeijingPoi) {
  if (poi.amapPoiId) return `id:${poi.amapPoiId}`
  return `text:${poi.name.replace(/\s+/g, "")}|${poi.address.replace(/\s+/g, "")}|${poi.lng || ""},${poi.lat || ""}`
}

function createIntro(poi: {
  name: string
  rootCategory: BeijingPoiRootCategory
  district: string
  businessArea?: string
  subTags: BeijingPoi["subTags"]
}) {
  const area = poi.businessArea || poi.district || "北京"
  const tagLabels = poi.subTags.map((tag) => SUB_TAG_LABELS[tag]).slice(0, 2)
  const tagText = tagLabels.length ? tagLabels.join("、") : ROOT_CATEGORY_LABELS[poi.rootCategory]
  if (poi.rootCategory === "food") {
    return `${poi.name}位于${area}，适合作为${tagText}用餐候选。`
  }
  if (poi.rootCategory === "hotel") {
    return `${poi.name}位于${area}，适合作为${tagText}住宿候选。`
  }
  return `${poi.name}位于${area}，适合${tagText}行程。`
}

export function normalizeAmapPoiToBeijingPoi(
  raw: AmapPoiInput,
  requestedRoot: BeijingPoiRootCategory,
  importedAt = new Date().toISOString()
): NormalizedAmapPoiResult {
  const name = toText(raw.name)
  const address = normalizeAddress(raw.address)
  const district = toText(raw.adname)
  const classification = classifyPoiRootCategory(raw)

  if (!name) {
    return {
      quarantine: {
        requestedRoot,
        name: "",
        type: raw.type,
        typecode: raw.typecode,
        reason: "missing_name",
      },
    }
  }

  if (!classification.rootCategory || classification.quarantined || classification.confidence < 60) {
    return {
      quarantine: {
        requestedRoot,
        name,
        type: raw.type,
        typecode: raw.typecode,
        reason: classification.reason,
      },
    }
  }

  if (classification.rootCategory !== requestedRoot) {
    return {
      quarantine: {
        requestedRoot,
        name,
        type: raw.type,
        typecode: raw.typecode,
        reason: `category_mismatch:${classification.rootCategory}`,
      },
    }
  }

  if (
    !isBeijingPoi({
      city: toText(raw.cityname),
      province: toText(raw.pname),
      district,
      address,
      adcode: raw.adcode,
    })
  ) {
    return {
      quarantine: {
        requestedRoot,
        name,
        type: raw.type,
        typecode: raw.typecode,
        reason: "outside_beijing",
      },
    }
  }

  if (!isFormalPoi({ name, address })) {
    return {
      quarantine: {
        requestedRoot,
        name,
        type: raw.type,
        typecode: raw.typecode,
        reason: "non_destination_poi",
      },
    }
  }

  const location = parseLocation(raw.location)
  const price = toNumber(raw.biz_ext?.cost)
  const rating = toNumber(raw.biz_ext?.rating, 4.5)
  const businessArea = toText(raw.business_area) || toText(raw.business?.business_area)
  const photo = firstPhoto(raw)
  const subTags = buildPoiSubTags(
    {
      name,
      type: raw.type,
      typecode: raw.typecode,
      address,
      district,
      businessArea,
      rootCategory: classification.rootCategory,
      rating,
      price,
    },
    classification.rootCategory
  )
  const poiBase = {
    name,
    rootCategory: classification.rootCategory,
    district,
    businessArea,
    subTags,
  }

  return {
    poi: {
      id: makePoiId(raw, classification.rootCategory),
      amapPoiId: raw.id,
      rootCategory: classification.rootCategory,
      name,
      province: toText(raw.pname) || "北京",
      city: toText(raw.cityname) || "北京",
      district,
      address,
      lng: location.lng,
      lat: location.lat,
      rating,
      price,
      tags: [ROOT_CATEGORY_LABELS[classification.rootCategory], ...subTags.map((tag) => SUB_TAG_LABELS[tag])],
      subTags,
      intro: createIntro(poiBase),
      source: "amap",
      type: raw.type,
      typecode: raw.typecode,
      businessArea,
      phone: toText(raw.tel),
      openTime: toText(raw.opentime) || toText(raw.open_time),
      imageUrl: photo?.url,
      imageTitle: photo?.title,
      imageSource: photo?.url ? "amap" : "placeholder",
      confidence: classification.confidence,
      importedAt,
    },
  }
}

function mergeKeywordConfig(input?: Partial<Record<BeijingPoiRootCategory, string[]>>) {
  return {
    scenic: input?.scenic || BEIJING_POI_IMPORT_KEYWORDS.scenic,
    food: input?.food || BEIJING_POI_IMPORT_KEYWORDS.food,
    hotel: input?.hotel || BEIJING_POI_IMPORT_KEYWORDS.hotel,
  } satisfies Record<BeijingPoiRootCategory, string[]>
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function runBeijingPoiImport(options: PoiImporterOptions = {}): Promise<PoiImportResult> {
  const apiKey = options.apiKey || process.env.AMAP_WEB_SERVICE_KEY?.trim()
  if (!apiKey) {
    throw new Error("AMAP_WEB_SERVICE_KEY_MISSING")
  }

  const keywordConfig = mergeKeywordConfig(options.keywords)
  const pageLimit = Math.max(1, options.pageLimit ?? 1)
  const offset = Math.max(1, Math.min(25, options.offset ?? 20))
  const maxPerKeyword = Math.max(1, options.maxPerKeyword ?? 40)
  const importedAt = new Date().toISOString()
  const seen = new Set<string>()
  const pois: BeijingPoi[] = []
  const quarantine: PoiImportQuarantineItem[] = []
  const stats: PoiImportStats = {
    dryRun: options.dryRun !== false,
    endpoint: "amap:v3/place/text",
    keywordCount: Object.values(keywordConfig).flat().length,
    fetched: 0,
    accepted: 0,
    deduped: 0,
    quarantined: 0,
    withImage: 0,
    noImage: 0,
    byRoot: { scenic: 0, food: 0, hotel: 0 },
  }

  for (const rootCategory of Object.keys(keywordConfig) as BeijingPoiRootCategory[]) {
    for (const keyword of keywordConfig[rootCategory]) {
      let acceptedForKeyword = 0

      for (let page = 1; page <= pageLimit; page += 1) {
        const result = await fetchAmapPoiText({
          apiKey,
          keyword,
          rootCategory,
          page,
          offset,
          timeoutMs: options.timeoutMs,
        })
        stats.fetched += result.pois.length

        for (const rawPoi of result.pois) {
          const normalized = normalizeAmapPoiToBeijingPoi(rawPoi, rootCategory, importedAt)
          if (!normalized.poi) {
            if (normalized.quarantine) {
              quarantine.push({ keyword, ...normalized.quarantine })
              stats.quarantined += 1
            }
            continue
          }

          const key = dedupeKey(normalized.poi)
          if (seen.has(key)) {
            stats.deduped += 1
            continue
          }

          seen.add(key)
          pois.push(normalized.poi)
          stats.accepted += 1
          stats.byRoot[normalized.poi.rootCategory] += 1
          if (normalized.poi.imageUrl) stats.withImage += 1
          else stats.noImage += 1
          acceptedForKeyword += 1

          if (acceptedForKeyword >= maxPerKeyword) break
        }

        if (acceptedForKeyword >= maxPerKeyword || result.pois.length < offset) break
        if (options.delayMs !== 0) await delay(options.delayMs ?? 120)
      }
    }
  }

  return {
    stats,
    pois,
    quarantine,
  }
}
