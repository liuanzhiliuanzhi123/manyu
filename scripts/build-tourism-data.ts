
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import XLSX from "xlsx"
import { classifyPlaceCategory } from "../lib/place-classifier"
import {
  inferFromAddress,
  isMunicipality,
  isSpecialRegion,
  isValidProvinceName,
  normalizeAdminPair,
  sanitizeCityName,
  sanitizeProvinceName,
} from "../lib/location-normalizer"

type UnknownRecord = Record<string, unknown>
type PoiCategory = "attraction" | "restaurant" | "hotel"

interface ALevelRecord {
  sourceId: string
  name: string
  province: string
  level: string
  lng?: number
  lat?: number
}

interface DetailRecord {
  sourceId: string
  city: string
  name: string
  level: string
  rating: number
  price: number
  sales: number
  province: string
  district: string
  lng?: number
  lat?: number
  intro: string
  isFree: boolean
  address: string
  coverImage?: string
  gallery: string[]
  category: PoiCategory
}

interface PoiImageBinding {
  name: string
  city: string
  coverImage?: string
  gallery: string[]
}

interface NormalizedPoi {
  id: string
  slug: string
  name: string
  province: string
  city: string
  district: string
  category: PoiCategory
  level: string
  rating: number
  price: number
  sales: number
  lng?: number
  lat?: number
  intro: string
  isFree: boolean
  address: string
  coverImage: string
  gallery: string[]
  tags: string[]
}

interface NormalizedCity {
  id: string
  slug: string
  province: string
  city: string
  tagline: string
  tags: string[]
  poiCount: number
  attractionCount: number
  restaurantCount: number
  hotelCount: number
  avgRating: number
  avgPrice: number
  coverImage: string
}

interface NormalizedHotel {
  id: string
  slug: string
  name: string
  city: string
  province: string
  district?: string
  price: number
  rating: number
  level?: string
  coverImage: string
  tags: string[]
  sourceType: "poi"
  reason?: string
}

interface NormalizedReview {
  id: string
  reviewCount: number
  season: string
  userScore: number
  userRegion: string
  purpose: string
  hotelStar: number
  hotelPrice: number
  hotelScore: number
  content: string
  tags: string[]
}

interface ReviewInsightTag {
  tag: string
  count: number
  ratio: number
}

interface ReviewInsightPurpose {
  purpose: string
  count: number
  avgUserScore: number
  avgHotelScore: number
  avgHotelPrice: number
  topTags: string[]
}

interface ReviewInsights {
  generatedAt: string
  totalReviews: number
  tagStats: ReviewInsightTag[]
  purposeStats: ReviewInsightPurpose[]
  recommendationTags: string[]
}

interface PoiImageMapItem {
  poiId: string
  slug: string
  name: string
  city: string
  coverImage: string
  gallery: string[]
  matchedBy:
    | "data-cover"
    | "image-map"
    | "public-poi"
    | "public-city"
    | "placeholder"
}

interface ClientPoiRecord {
  id: string
  slug: string
  name: string
  province: string
  city: string
  district: string
  category: PoiCategory
  level: string
  rating: number
  price: number
  sales: number
  lng?: number
  lat?: number
  intro: string
  isFree: boolean
  address: string
  coverImage: string
  gallery: string[]
  tags: string[]
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const RAW_DIR = path.join(ROOT_DIR, "data", "raw")
const NORMALIZED_DIR = path.join(ROOT_DIR, "data", "normalized")
const PUBLIC_DIR = path.join(ROOT_DIR, "public")
const PLACEHOLDER_IMAGE = "/images/placeholders/poi-default.jpg"

const RAW_FILES = {
  aLevel: path.join(RAW_DIR, "中国A级景区数据.xls"),
  detail: path.join(RAW_DIR, "旅游景点(1).xlsx"),
  reviews: path.join(RAW_DIR, "总评论.csv"),
  poiImages: path.join(RAW_DIR, "poi_images.csv"),
}

const REVIEW_TAG_RULES: Array<{ tag: string; patterns: RegExp[] }> = [
  { tag: "交通便利", patterns: [/地铁/u, /公交/u, /交通便利/u, /出行方便/u, /交通方便/u] },
  { tag: "适合亲子", patterns: [/亲子/u, /孩子/u, /小孩/u, /家庭/u] },
  { tag: "服务好", patterns: [/服务好/u, /服务态度/u, /热情/u, /贴心/u, /前台/u] },
  { tag: "干净卫生", patterns: [/干净/u, /卫生/u, /整洁/u, /清洁/u] },
  { tag: "适合老人", patterns: [/老人/u, /长辈/u, /父母/u] },
  { tag: "餐饮方便", patterns: [/早餐/u, /餐厅/u, /吃饭/u, /餐饮/u, /美食/u] },
  { tag: "商务友好", patterns: [/商务/u, /出差/u, /会议/u, /办公/u] },
  { tag: "适合度假", patterns: [/度假/u, /休闲/u, /放松/u, /旅游/u] },
  { tag: "安静", patterns: [/安静/u, /不吵/u, /隔音/u] },
  { tag: "位置中心", patterns: [/市中心/u, /中心位置/u, /核心地段/u, /位置好/u] },
]

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  return ""
}

function getField(row: UnknownRecord, candidateKeys: string[]): unknown {
  for (const key of candidateKeys) {
    if (key in row) return row[key]
  }
  const normalizedMap = new Map<string, unknown>()
  for (const [key, value] of Object.entries(row)) {
    normalizedMap.set(key.replace(/\s+/g, ""), value)
  }
  for (const key of candidateKeys) {
    const normalized = key.replace(/\s+/g, "")
    if (normalizedMap.has(normalized)) {
      return normalizedMap.get(normalized)
    }
  }
  return undefined
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""))
    if (Number.isFinite(parsed)) return parsed
  }
  return NaN
}

function toBoolean(value: unknown, price: number): boolean {
  if (typeof value === "boolean") return value
  const text = toText(value)
  if (!text) return price <= 0
  if (/^(true|是|免费|yes|1)$/iu.test(text)) return true
  if (/^(false|否|收费|no|0)$/iu.test(text)) return false
  return price <= 0
}

function normalizeCityName(city: string): string {
  return sanitizeCityName(city)
}

function normalizeProvinceName(province: string): string {
  return sanitizeProvinceName(province)
}

function normalizeNameStrict(name: string): string {
  return name.trim().toLowerCase().replace(/[\s·•\-—_()（）【】[\]/\\,，。.!！?？:：'"“”‘’]/gu, "")
}

function normalizeNameLoose(name: string): string {
  let value = normalizeNameStrict(name)
  for (const token of ["旅游景区", "旅游区", "风景名胜区", "风景区", "景区", "景点", "公园", "度假区"]) {
    value = value.replaceAll(token, "")
  }
  return value
}

function hashString(input: string): number {
  let hash = 0
  for (const char of input) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash || 1
}

function makeSlug(input: string, prefix: string): string {
  const ascii = input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (ascii) return ascii
  return `${prefix}-${hashString(input).toString(36)}`
}

function parseCoordinate(value: unknown): [number, number] | null {
  const text = toText(value)
  if (!text) return null
  const parts = text.split(/[,\s，|]+/u).filter(Boolean)
  if (parts.length < 2) return null
  const lng = Number(parts[0])
  const lat = Number(parts[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return normalizeLngLat(lng, lat)
}

function normalizeLngLat(rawLng: number, rawLat: number): [number, number] | null {
  let lng = rawLng
  let lat = rawLat
  if (Math.abs(lng) <= 90 && Math.abs(lat) > 90) {
    ;[lng, lat] = [lat, lng]
  }
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))]
}

function splitRegion(value: string) {
  const parts = value
    .split(/[·/|>\-—\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean)
  const [part1 = "", part2 = "", part3 = ""] = parts
  return { part1, part2, part3 }
}

function ensurePlaceholderImage() {
  const placeholderDir = path.join(PUBLIC_DIR, "images", "placeholders")
  const placeholderTarget = path.join(placeholderDir, "poi-default.jpg")
  if (!existsSync(placeholderTarget)) {
    mkdirSync(placeholderDir, { recursive: true })
    const fallback = path.join(PUBLIC_DIR, "placeholder.jpg")
    if (existsSync(fallback)) {
      copyFileSync(fallback, placeholderTarget)
    }
  }
}

function readTableRows(filePath: string): UnknownRecord[] {
  if (!existsSync(filePath)) return []
  const workbook = XLSX.readFile(filePath, { raw: false })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) return []
  const worksheet = workbook.Sheets[firstSheet]
  return XLSX.utils.sheet_to_json<UnknownRecord>(worksheet, { defval: "" })
}

function normalizeImagePath(value: unknown): string | undefined {
  const text = toText(value)
  if (!text) return undefined
  if (/^https?:\/\//iu.test(text)) return text
  if (text.startsWith("/")) return text
  return `/${text.replace(/^\.?\//u, "")}`
}

function parseGallery(value: unknown): string[] {
  const text = toText(value)
  if (!text) return []
  return text
    .split(/[|;,，；]/u)
    .map((item) => normalizeImagePath(item))
    .filter((item): item is string => Boolean(item))
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function parseALevelRecords(rows: UnknownRecord[]): ALevelRecord[] {
  return rows
    .map((row, index): ALevelRecord | null => {
      const name = toText(getField(row, ["景区名"]))
      if (!name) return null
      const provinceRaw = toText(getField(row, ["地区"]))
      let province = normalizeProvinceName(provinceRaw)
      if (!province) {
        const inferred = inferFromAddress(name)
        province = inferred.province
      }
      if (!isValidProvinceName(province)) return null
      const lngNumber = toNumber(getField(row, ["经度（WGS84坐标）", "经度"]))
      const latNumber = toNumber(getField(row, ["纬度（WGS84坐标）", "纬度"]))
      const normalized = Number.isFinite(lngNumber) && Number.isFinite(latNumber)
        ? normalizeLngLat(lngNumber, latNumber)
        : null
      return {
        sourceId: `a-level-${index}`,
        name,
        province,
        level: toText(row["景区等级"]),
        lng: normalized?.[0],
        lat: normalized?.[1],
      }
    })
    .filter((item): item is ALevelRecord => Boolean(item))
}

function parseDetailRecords(rows: UnknownRecord[]): DetailRecord[] {
  return rows
    .map((row, index): DetailRecord | null => {
      const name = toText(getField(row, ["名称"]))
      if (!name) return null
      const address = toText(getField(row, ["具体地址", "地址"]))
      const cityRaw = toText(getField(row, ["城市", "城市/地区", "目的地城市"]))
      const provinceRaw = toText(getField(row, ["省份", "省", "地区"]))
      const region = splitRegion(toText(getField(row, ["省/市/区", "省市区", "地区"])))
      const pair = normalizeAdminPair({
        province: provinceRaw || region.part1,
        city: cityRaw || region.part2 || region.part1,
        address,
      })
      let province = pair.province
      let city = pair.city

      if (isMunicipality(city) || isSpecialRegion(city)) {
        province = city
      }
      if (!city && (isMunicipality(province) || isSpecialRegion(province))) {
        city = province
      }
      if (!city && province) {
        city = province
      }

      const inferredFromAddress = inferFromAddress(address)
      if (!province) province = inferredFromAddress.province
      if (!city) city = inferredFromAddress.city || province
      if (
        city === province &&
        !isMunicipality(province) &&
        !isSpecialRegion(province) &&
        inferredFromAddress.city &&
        inferredFromAddress.city !== province
      ) {
        city = inferredFromAddress.city
      }

      if (!isValidProvinceName(province) || !city) {
        return null
      }

      const districtValue =
        toText(getField(row, ["区县", "区", "行政区"])) || region.part3 || region.part2
      const district = sanitizeCityName(districtValue)
      const coordinate = parseCoordinate(getField(row, ["坐标", "经纬度"]))
      const ratingRaw = toNumber(getField(row, ["评分"]))
      const rating = Number.isFinite(ratingRaw) ? Number(ratingRaw.toFixed(1)) : 0
      const priceRaw = toNumber(getField(row, ["价格", "门票价格"]))
      const price = Number.isFinite(priceRaw) ? Number(priceRaw.toFixed(2)) : 0
      const salesRaw = toNumber(getField(row, ["销量"]))
      const sales = Number.isFinite(salesRaw) ? Math.max(0, Math.round(salesRaw)) : 0
      const intro = toText(getField(row, ["简介"]))
      const level = toText(getField(row, ["星级", "景区等级"]))
      const isFree = toBoolean(getField(row, ["是否免费"]), price)
      const rawCategory = toText(getField(row, ["类别", "分类", "类型"]))
      const category = classifyPlaceCategory({
        name,
        intro,
        address,
        rawCategory,
        tags: [level],
      })
      const coverImage = normalizeImagePath(
        getField(row, ["封面图", "coverImage", "封面", "图片"])
      )
      const gallery = parseGallery(
        getField(row, ["图集", "gallery", "相册", "图片集"])
      )

      return {
        sourceId: `detail-${index}`,
        city,
        name,
        level,
        rating,
        price,
        sales,
        province,
        district,
        lng: coordinate?.[0],
        lat: coordinate?.[1],
        intro,
        isFree,
        address,
        coverImage,
        gallery,
        category,
      }
    })
    .filter((item): item is DetailRecord => Boolean(item))
}

function buildCityProvinceMap(records: DetailRecord[]) {
  const counter = new Map<string, Map<string, number>>()
  for (const record of records) {
    const city = normalizeCityName(record.city)
    const province = normalizeProvinceName(record.province)
    if (!city || !province) continue
    if (!counter.has(city)) counter.set(city, new Map<string, number>())
    const provinceMap = counter.get(city)
    if (!provinceMap) continue
    provinceMap.set(province, (provinceMap.get(province) ?? 0) + 1)
  }

  const result = new Map<string, string>()
  for (const [city, provinceCountMap] of counter.entries()) {
    const top = [...provinceCountMap.entries()].sort((a, b) => b[1] - a[1])[0]
    if (top?.[0]) result.set(city, top[0])
  }

  for (const direct of ["北京", "上海", "天津", "重庆", "香港", "澳门"]) {
    result.set(direct, direct)
  }

  return result
}

function repairDetailRecords(records: DetailRecord[]) {
  const cityProvinceMap = buildCityProvinceMap(records)

  return records
    .map((record) => {
      const fallback = normalizeAdminPair({
        province: record.province,
        city: record.city,
        address: record.address,
      })

      let province = fallback.province
      let city = fallback.city || province
      const inferred = inferFromAddress(record.address)
      if (
        city === province &&
        !isMunicipality(province) &&
        !isSpecialRegion(province) &&
        inferred.city &&
        inferred.city !== province
      ) {
        city = inferred.city
      }
      const mappedProvince = cityProvinceMap.get(city)
      if (mappedProvince) province = mappedProvince

      if (isSpecialRegion(city)) {
        province = city
      } else if (isSpecialRegion(province)) {
        city = province
      }
      if (isMunicipality(city)) province = city
      if (!city) city = province

      if (!isValidProvinceName(province) || !city) return null

      return {
        ...record,
        province,
        city,
      }
    })
    .filter((item): item is DetailRecord => Boolean(item))
}

function buildALevelIndex(records: ALevelRecord[]) {
  const exactMap = new Map<string, ALevelRecord[]>()
  const looseMap = new Map<string, ALevelRecord[]>()
  for (const record of records) {
    const strictKey = normalizeNameStrict(record.name)
    const looseKey = normalizeNameLoose(record.name)
    if (!exactMap.has(strictKey)) exactMap.set(strictKey, [])
    if (!looseMap.has(looseKey)) looseMap.set(looseKey, [])
    exactMap.get(strictKey)?.push(record)
    looseMap.get(looseKey)?.push(record)
  }
  return { exactMap, looseMap }
}

function pickBestALevelMatch(
  detail: DetailRecord,
  index: ReturnType<typeof buildALevelIndex>
): ALevelRecord | undefined {
  const strict = normalizeNameStrict(detail.name)
  const loose = normalizeNameLoose(detail.name)
  const exactCandidates = index.exactMap.get(strict) ?? []
  if (exactCandidates.length > 0) {
    return [...exactCandidates].sort((a, b) => {
      const aScore = a.province && detail.province.includes(a.province) ? 10 : 0
      const bScore = b.province && detail.province.includes(b.province) ? 10 : 0
      return bScore - aScore
    })[0]
  }

  const looseCandidates = index.looseMap.get(loose) ?? []
  for (const candidate of looseCandidates) {
    const left = normalizeNameLoose(candidate.name)
    const right = loose
    if (!left || !right) continue
    const distance = Math.abs(left.length - right.length)
    if (
      distance <= 4 &&
      (left.includes(right) || right.includes(left)) &&
      (!candidate.province || detail.province.includes(candidate.province))
    ) {
      return candidate
    }
  }
  return undefined
}

function readPublicImageLookup(rootDir: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!existsSync(rootDir)) return map
  const stack = [rootDir]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    for (const entry of readdirSync(current)) {
      const fullPath = path.join(current, entry)
      const stats = statSync(fullPath)
      if (stats.isDirectory()) {
        stack.push(fullPath)
        continue
      }
      const ext = path.extname(entry).toLowerCase()
      if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) continue
      const key = path.basename(entry, ext).toLowerCase()
      const relative = `/${path.relative(PUBLIC_DIR, fullPath).replace(/\\/g, "/")}`
      map.set(key, relative)
    }
  }
  return map
}

function readPublicImageFileNames(rootDir: string): string[] {
  if (!existsSync(rootDir)) return []
  const result: string[] = []
  const stack = [rootDir]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    for (const entry of readdirSync(current)) {
      const fullPath = path.join(current, entry)
      const stats = statSync(fullPath)
      if (stats.isDirectory()) {
        stack.push(fullPath)
        continue
      }
      const ext = path.extname(entry).toLowerCase()
      if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) continue
      result.push(entry.toLowerCase())
    }
  }
  return unique(result)
}

function parsePoiImageBindings(rows: UnknownRecord[]): Map<string, PoiImageBinding> {
  const map = new Map<string, PoiImageBinding>()
  for (const row of rows) {
    const name = toText(getField(row, ["名称"]))
    if (!name) continue
    const city = normalizeCityName(toText(getField(row, ["城市"])))
    const coverImage = normalizeImagePath(getField(row, ["封面图"]))
    const gallery = parseGallery(getField(row, ["图集"]))
    const key = `${normalizeNameLoose(name)}|${city}`
    map.set(key, { name, city, coverImage, gallery })
  }
  return map
}

function findPoiImageBinding(
  map: Map<string, PoiImageBinding>,
  name: string,
  city: string
): PoiImageBinding | undefined {
  const key = `${normalizeNameLoose(name)}|${normalizeCityName(city)}`
  const direct = map.get(key)
  if (direct) return direct
  const looseKey = `${normalizeNameLoose(name)}|`
  for (const [currentKey, value] of map.entries()) {
    if (currentKey.startsWith(looseKey)) return value
  }
  return undefined
}

function resolvePoiImage(options: {
  slug: string
  city: string
  explicitCover?: string
  explicitGallery: string[]
  mappedCover?: string
  mappedGallery: string[]
  poiImageLookup: Map<string, string>
  hotelImageLookup: Map<string, string>
  foodImageLookup: Map<string, string>
  cityImageLookup: Map<string, string>
  category: PoiCategory
}): { coverImage: string; gallery: string[]; matchedBy: PoiImageMapItem["matchedBy"] } {
  const citySlug = makeSlug(options.city, "city")
  const categoryLookup =
    options.category === "hotel"
      ? options.hotelImageLookup
      : options.category === "restaurant"
      ? options.foodImageLookup
      : options.poiImageLookup
  const coverFromPublicPoi = categoryLookup.get(options.slug.toLowerCase())
  const coverFromPublicCity = options.cityImageLookup.get(citySlug.toLowerCase())

  let matchedBy: PoiImageMapItem["matchedBy"] = "placeholder"
  let coverImage = PLACEHOLDER_IMAGE

  if (options.explicitCover) {
    coverImage = options.explicitCover
    matchedBy = "data-cover"
  } else if (options.mappedCover) {
    coverImage = options.mappedCover
    matchedBy = "image-map"
  } else if (coverFromPublicPoi) {
    coverImage = coverFromPublicPoi
    matchedBy = "public-poi"
  } else if (coverFromPublicCity) {
    coverImage = coverFromPublicCity
    matchedBy = "public-city"
  }

  const gallery = unique(
    [coverImage, ...options.explicitGallery, ...options.mappedGallery].filter(Boolean)
  )
  return { coverImage, gallery, matchedBy }
}

function mergePoiRecords(
  detailRecords: DetailRecord[],
  aLevelRecords: ALevelRecord[],
  imageMap: Map<string, PoiImageBinding>
) {
  const merged = new Map<string, NormalizedPoi>()
  const imageItems: PoiImageMapItem[] = []
  const levelIndex = buildALevelIndex(aLevelRecords)
  const usedALevelIds = new Set<string>()
  const poiImageLookup = readPublicImageLookup(path.join(PUBLIC_DIR, "images", "pois"))
  const hotelImageLookup = readPublicImageLookup(path.join(PUBLIC_DIR, "images", "hotels"))
  const foodImageLookup = readPublicImageLookup(path.join(PUBLIC_DIR, "images", "foods"))
  const cityImageLookup = readPublicImageLookup(path.join(PUBLIC_DIR, "images", "cities"))

  for (const detail of detailRecords) {
    const matched = pickBestALevelMatch(detail, levelIndex)
    if (matched) usedALevelIds.add(matched.sourceId)
    const mergedLevel = detail.level || matched?.level || ""
    const mergedLng = detail.lng ?? matched?.lng
    const mergedLat = detail.lat ?? matched?.lat
    let city = normalizeCityName(detail.city || detail.province)
    let province = normalizeProvinceName(detail.province || city)
    if (isSpecialRegion(city)) {
      province = city
    } else if (isSpecialRegion(province)) {
      city = province
    }
    if (isMunicipality(city)) {
      province = city
    }
    if (!city) city = province
    if (!city || !isValidProvinceName(province)) continue
    const mergeKey = `${normalizeNameLoose(detail.name)}|${city || province}`
    const slug = makeSlug(`${city || province}-${detail.name}`, "poi")
    const id = `poi-${hashString(`${detail.name}|${city}|${detail.address}`).toString(36)}`
    const imageBinding = findPoiImageBinding(imageMap, detail.name, city)
    const imageResult = resolvePoiImage({
      slug,
      city,
      explicitCover: detail.coverImage,
      explicitGallery: detail.gallery,
      mappedCover: imageBinding?.coverImage,
      mappedGallery: imageBinding?.gallery ?? [],
      poiImageLookup,
      hotelImageLookup,
      foodImageLookup,
      cityImageLookup,
      category: detail.category,
    })
    const tags = unique(
      [
        mergedLevel ? `${mergedLevel}景区` : "",
        detail.category === "restaurant" ? "美食" : "",
        detail.category === "hotel" ? "住宿" : "景点",
        detail.isFree ? "免费" : "收费",
        city,
        detail.district,
      ].filter(Boolean)
    )

    const item: NormalizedPoi = {
      id,
      slug,
      name: detail.name,
      province: province || city,
      city: city || province,
      district: detail.district,
      category: detail.category,
      level: mergedLevel,
      rating: detail.rating,
      price: detail.price,
      sales: detail.sales,
      lng: mergedLng,
      lat: mergedLat,
      intro: detail.intro,
      isFree: detail.isFree || detail.price <= 0,
      address: detail.address,
      coverImage: imageResult.coverImage,
      gallery: imageResult.gallery,
      tags,
    }

    const existing = merged.get(mergeKey)
    if (!existing) {
      merged.set(mergeKey, item)
      imageItems.push({
        poiId: item.id,
        slug: item.slug,
        name: item.name,
        city: item.city,
        coverImage: item.coverImage,
        gallery: item.gallery,
        matchedBy: imageResult.matchedBy,
      })
      continue
    }

    const keep = existing.sales >= item.sales ? existing : item
    keep.gallery = unique([...existing.gallery, ...item.gallery])
    keep.tags = unique([...existing.tags, ...item.tags])
    if (!keep.lng && item.lng) keep.lng = item.lng
    if (!keep.lat && item.lat) keep.lat = item.lat
    if (!keep.level && item.level) keep.level = item.level
    if ((!keep.intro || keep.intro.length < 8) && item.intro) keep.intro = item.intro
    if (!keep.address && item.address) keep.address = item.address
    merged.set(mergeKey, keep)
  }

  for (const levelRecord of aLevelRecords) {
    if (usedALevelIds.has(levelRecord.sourceId)) continue
    const province = normalizeProvinceName(levelRecord.province)
    if (!isValidProvinceName(province)) continue
    const city = province
    const slug = makeSlug(`${province}-${levelRecord.name}`, "poi")
    const id = `poi-${hashString(`a|${levelRecord.name}|${province}`).toString(36)}`
    const imageResult = resolvePoiImage({
      slug,
      city,
      explicitCover: undefined,
      explicitGallery: [],
      mappedCover: undefined,
      mappedGallery: [],
      poiImageLookup,
      hotelImageLookup,
      foodImageLookup,
      cityImageLookup,
      category: "attraction",
    })
    const mergeKey = `${normalizeNameLoose(levelRecord.name)}|${city}`
    if (merged.has(mergeKey)) continue

    const item: NormalizedPoi = {
      id,
      slug,
      name: levelRecord.name,
      province,
      city,
      district: "",
      category: "attraction",
      level: levelRecord.level,
      rating: 0,
      price: 0,
      sales: 0,
      lng: levelRecord.lng,
      lat: levelRecord.lat,
      intro: `${levelRecord.name}（${levelRecord.level || "A级"}景区）`,
      isFree: true,
      address: `${province}${levelRecord.name}`,
      coverImage: imageResult.coverImage,
      gallery: imageResult.gallery,
      tags: unique([`${levelRecord.level || "A级"}景区`, "全国景区", province]),
    }
    merged.set(mergeKey, item)
    imageItems.push({
      poiId: item.id,
      slug: item.slug,
      name: item.name,
      city: item.city,
      coverImage: item.coverImage,
      gallery: item.gallery,
      matchedBy: imageResult.matchedBy,
    })
  }

  const pois = [...merged.values()].sort((a, b) => {
    if (b.sales !== a.sales) return b.sales - a.sales
    if (b.rating !== a.rating) return b.rating - a.rating
    return a.name.localeCompare(b.name, "zh-CN")
  })

  return { pois, imageItems }
}

function buildClientPois(pois: NormalizedPoi[], limit = 1800): ClientPoiRecord[] {
  const byCity = new Map<string, NormalizedPoi[]>()
  for (const poi of pois) {
    const key = `${poi.province}|${poi.city}`
    if (!byCity.has(key)) byCity.set(key, [])
    byCity.get(key)?.push(poi)
  }

  const selectedById = new Map<string, NormalizedPoi>()
  const addSelected = (items: NormalizedPoi[]) => {
    for (const item of items) {
      if (!selectedById.has(item.id)) selectedById.set(item.id, item)
    }
  }

  // Keep category diversity: avoid restaurants/hotels being squeezed out by hot attractions.
  const allRestaurants = pois
    .filter((item) => item.category === "restaurant")
    .sort((a, b) => {
      if (b.sales !== a.sales) return b.sales - a.sales
      if (b.rating !== a.rating) return b.rating - a.rating
      return a.name.localeCompare(b.name, "zh-CN")
    })
  const allHotels = pois
    .filter((item) => item.category === "hotel")
    .sort((a, b) => {
      if (b.sales !== a.sales) return b.sales - a.sales
      if (b.rating !== a.rating) return b.rating - a.rating
      return a.name.localeCompare(b.name, "zh-CN")
    })

  addSelected(allRestaurants)
  addSelected(allHotels)

  for (const group of byCity.values()) {
    const sorted = [...group].sort((a, b) => {
      if (b.sales !== a.sales) return b.sales - a.sales
      if (b.rating !== a.rating) return b.rating - a.rating
      return a.name.localeCompare(b.name, "zh-CN")
    })
    const attraction = sorted.filter((item) => item.category === "attraction").slice(0, 12)
    const restaurant = sorted.filter((item) => item.category === "restaurant").slice(0, 5)
    const hotel = sorted.filter((item) => item.category === "hotel").slice(0, 3)
    addSelected([...attraction, ...restaurant, ...hotel])
  }

  const ranked = [...selectedById.values()].sort((a, b) => {
    if (b.sales !== a.sales) return b.sales - a.sales
    if (b.rating !== a.rating) return b.rating - a.rating
    // Keep category diversity in the head of list.
    if (a.category !== b.category) {
      const categoryWeight: Record<PoiCategory, number> = {
        attraction: 1,
        restaurant: 2,
        hotel: 2,
      }
      return categoryWeight[b.category] - categoryWeight[a.category]
    }
    return a.name.localeCompare(b.name, "zh-CN")
  })

  const mustKeepIds = new Set([
    ...allRestaurants.map((item) => item.id),
    ...allHotels.map((item) => item.id),
  ])

  const mandatory = ranked.filter((item) => mustKeepIds.has(item.id))
  const remainder = ranked.filter((item) => !mustKeepIds.has(item.id))
  const finalList =
    mandatory.length >= limit
      ? mandatory.slice(0, limit)
      : [...mandatory, ...remainder.slice(0, limit - mandatory.length)]

  return finalList.map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    province: item.province,
    city: item.city,
    district: item.district,
    category: item.category,
    level: item.level,
    rating: item.rating,
    price: item.price,
    sales: item.sales,
    lng: item.lng,
    lat: item.lat,
    intro: item.intro,
    isFree: item.isFree,
    address: item.address,
    coverImage: item.coverImage,
    gallery: item.gallery.slice(0, 4),
    tags: item.tags.slice(0, 6),
  }))
}

function buildCityTagline(input: {
  attractionCount: number
  restaurantCount: number
  hotelCount: number
  avgPrice: number
  tags: string[]
}) {
  if (input.attractionCount >= 20 && input.restaurantCount >= 8) {
    return "景点与美食密度高，适合经典深度游"
  }
  if (input.hotelCount >= 8) {
    return "住宿选择丰富，适合度假慢游"
  }
  if (input.avgPrice > 260) {
    return "高品质体验集中，适合品质旅行"
  }
  if (input.tags.some((tag) => tag.includes("免费"))) {
    return "免费与低预算选择较多，适合轻预算出行"
  }
  return "路线可串联性好，适合周末和短假出行"
}

function buildCities(pois: NormalizedPoi[]): NormalizedCity[] {
  const cityMap = new Map<string, NormalizedPoi[]>()
  for (const poi of pois) {
    let city = normalizeCityName(poi.city || poi.province)
    let province = normalizeProvinceName(poi.province || poi.city)
    if (!isValidProvinceName(province)) continue
    if (!city) city = province
    if (isSpecialRegion(city)) {
      province = city
    } else if (isSpecialRegion(province)) {
      city = province
    }
    if (isMunicipality(city)) province = city
    if (!city) continue
    const key = `${province}|${city}`
    if (!cityMap.has(key)) cityMap.set(key, [])
    cityMap.get(key)?.push(poi)
  }

  const cities: NormalizedCity[] = []
  for (const [key, group] of cityMap.entries()) {
    const [province, city] = key.split("|")
    const attractionCount = group.filter((item) => item.category === "attraction").length
    const restaurantCount = group.filter((item) => item.category === "restaurant").length
    const hotelCount = group.filter((item) => item.category === "hotel").length
    const avgRating =
      group.reduce((sum, item) => sum + (item.rating || 0), 0) / Math.max(1, group.length)
    const pricedItems = group.filter((item) => item.price > 0)
    const avgPrice =
      pricedItems.reduce((sum, item) => sum + item.price, 0) / Math.max(1, pricedItems.length)
    const tagCount = new Map<string, number>()
    for (const poi of group) {
      for (const tag of poi.tags) {
        if (!tag) continue
        tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1)
      }
    }
    const tags = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([tag]) => tag)

    const tagline = buildCityTagline({
      attractionCount,
      restaurantCount,
      hotelCount,
      avgPrice,
      tags,
    })

    const coverImage = group[0]?.coverImage || PLACEHOLDER_IMAGE
    cities.push({
      id: `city-${hashString(key).toString(36)}`,
      slug: makeSlug(`${province}-${city}`, "city"),
      province: province || city,
      city: city || province,
      tagline,
      tags,
      poiCount: group.length,
      attractionCount,
      restaurantCount,
      hotelCount,
      avgRating: Number(avgRating.toFixed(2)),
      avgPrice: Number(avgPrice.toFixed(2)),
      coverImage,
    })
  }
  return cities.sort((a, b) => b.poiCount - a.poiCount)
}

function detectReviewTags(content: string, purpose: string): string[] {
  const tags: string[] = []
  for (const rule of REVIEW_TAG_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(content))) {
      tags.push(rule.tag)
    }
  }
  if (/亲子/u.test(purpose)) tags.push("适合亲子")
  if (/商务/u.test(purpose)) tags.push("商务友好")
  if (/度假|旅游/u.test(purpose)) tags.push("适合度假")
  return unique(tags)
}

function parseReviews(rows: UnknownRecord[]) {
  const reviews: NormalizedReview[] = []
  const tagWeightMap = new Map<string, number>()
  const purposeMap = new Map<
    string,
    { count: number; sumUserScore: number; sumHotelScore: number; sumHotelPrice: number; tags: Map<string, number> }
  >()

  rows.forEach((row, index) => {
    const content = toText(getField(row, ["用户评论"]))
    if (!content) return
    const purpose = toText(getField(row, ["出行目的"])) || "其他"
    const reviewCountRaw = toNumber(getField(row, ["用户点评数"]))
    const reviewCount = Number.isFinite(reviewCountRaw) ? Math.max(1, Math.round(reviewCountRaw)) : 1
    const userScoreRaw = toNumber(getField(row, ["用户评分"]))
    const hotelScoreRaw = toNumber(getField(row, ["酒店评分"]))
    const hotelPriceRaw = toNumber(getField(row, ["酒店价格"]))
    const hotelStarRaw = toNumber(getField(row, ["酒店星级"]))
    const userScore = Number.isFinite(userScoreRaw) ? Number(userScoreRaw.toFixed(2)) : 0
    const hotelScore = Number.isFinite(hotelScoreRaw) ? Number(hotelScoreRaw.toFixed(2)) : 0
    const hotelPrice = Number.isFinite(hotelPriceRaw) ? Number(hotelPriceRaw.toFixed(2)) : 0
    const hotelStar = Number.isFinite(hotelStarRaw) ? Number(hotelStarRaw.toFixed(1)) : 0
    const tags = detectReviewTags(content, purpose)

    reviews.push({
      id: `review-${index + 1}`,
      reviewCount,
      season: toText(getField(row, ["入住季节"])),
      userScore,
      userRegion: toText(getField(row, ["用户地区"])),
      purpose,
      hotelStar,
      hotelPrice,
      hotelScore,
      content,
      tags,
    })

    for (const tag of tags) {
      tagWeightMap.set(tag, (tagWeightMap.get(tag) ?? 0) + reviewCount)
    }

    if (!purposeMap.has(purpose)) {
      purposeMap.set(purpose, {
        count: 0,
        sumUserScore: 0,
        sumHotelScore: 0,
        sumHotelPrice: 0,
        tags: new Map<string, number>(),
      })
    }
    const purposeBucket = purposeMap.get(purpose)
    if (!purposeBucket) return
    purposeBucket.count += reviewCount
    purposeBucket.sumUserScore += userScore * reviewCount
    purposeBucket.sumHotelScore += hotelScore * reviewCount
    purposeBucket.sumHotelPrice += hotelPrice * reviewCount
    for (const tag of tags) {
      purposeBucket.tags.set(tag, (purposeBucket.tags.get(tag) ?? 0) + reviewCount)
    }
  })

  const totalWeight = [...tagWeightMap.values()].reduce((sum, value) => sum + value, 0)
  const tagStats: ReviewInsightTag[] = [...tagWeightMap.entries()]
    .map(([tag, count]) => ({
      tag,
      count,
      ratio: totalWeight > 0 ? Number((count / totalWeight).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const purposeStats: ReviewInsightPurpose[] = [...purposeMap.entries()]
    .map(([purpose, bucket]) => {
      const topTags = [...bucket.tags.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag]) => tag)
      return {
        purpose,
        count: bucket.count,
        avgUserScore:
          bucket.count > 0 ? Number((bucket.sumUserScore / bucket.count).toFixed(2)) : 0,
        avgHotelScore:
          bucket.count > 0 ? Number((bucket.sumHotelScore / bucket.count).toFixed(2)) : 0,
        avgHotelPrice:
          bucket.count > 0 ? Number((bucket.sumHotelPrice / bucket.count).toFixed(2)) : 0,
        topTags,
      }
    })
    .sort((a, b) => b.count - a.count)

  const insights: ReviewInsights = {
    generatedAt: new Date().toISOString(),
    totalReviews: reviews.length,
    tagStats,
    purposeStats,
    recommendationTags: tagStats.slice(0, 6).map((item) => item.tag),
  }

  return { reviews, insights }
}

function buildHotels(
  pois: NormalizedPoi[],
  insights: ReviewInsights
): NormalizedHotel[] {
  const topInsightTags = insights.tagStats.slice(0, 4).map((item) => item.tag)
  return pois
    .filter((item) => item.category === "hotel")
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      city: item.city,
      province: item.province,
      district: item.district,
      price: item.price,
      rating: item.rating,
      level: item.level,
      coverImage: item.coverImage,
      tags: unique([...item.tags, ...topInsightTags.slice(0, 2)]),
      sourceType: "poi",
      reason: "Based on local hotel entity and review-tag enhancement.",
    }))
}

function writeJson(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function run() {
  ensurePlaceholderImage()
  mkdirSync(NORMALIZED_DIR, { recursive: true })

  const aLevelRows = readTableRows(RAW_FILES.aLevel)
  const detailRows = readTableRows(RAW_FILES.detail)
  const reviewRows = readTableRows(RAW_FILES.reviews)
  const poiImageRows = readTableRows(RAW_FILES.poiImages)

  if (aLevelRows.length === 0) {
    throw new Error(`未找到或无法读取文件：${RAW_FILES.aLevel}`)
  }
  if (detailRows.length === 0) {
    throw new Error(`未找到或无法读取文件：${RAW_FILES.detail}`)
  }
  if (reviewRows.length === 0) {
    throw new Error(`未找到或无法读取文件：${RAW_FILES.reviews}`)
  }

  const aLevelRecords = parseALevelRecords(aLevelRows)
  const detailRecords = repairDetailRecords(parseDetailRecords(detailRows))
  const poiImageBindings = parsePoiImageBindings(poiImageRows)
  const { pois, imageItems } = mergePoiRecords(detailRecords, aLevelRecords, poiImageBindings)
  const clientPois = buildClientPois(pois)
  const cities = buildCities(pois)
  const { reviews, insights } = parseReviews(reviewRows)
  const hotels = buildHotels(pois, insights)
  const localImageManifest = {
    pois: readPublicImageFileNames(path.join(PUBLIC_DIR, "images", "pois")),
    hotels: readPublicImageFileNames(path.join(PUBLIC_DIR, "images", "hotels")),
    foods: readPublicImageFileNames(path.join(PUBLIC_DIR, "images", "foods")),
    cities: readPublicImageFileNames(path.join(PUBLIC_DIR, "images", "cities")),
  }

  writeJson(path.join(NORMALIZED_DIR, "pois.json"), pois)
  writeJson(path.join(NORMALIZED_DIR, "cities.json"), cities)
  writeJson(path.join(NORMALIZED_DIR, "hotels.json"), hotels)
  writeJson(path.join(NORMALIZED_DIR, "reviews.json"), reviews)
  writeJson(path.join(NORMALIZED_DIR, "review-insights.json"), insights)
  writeJson(path.join(NORMALIZED_DIR, "poi-image-map.json"), imageItems)
  writeJson(path.join(NORMALIZED_DIR, "client-pois.json"), clientPois)
  writeJson(path.join(NORMALIZED_DIR, "local-image-manifest.json"), localImageManifest)

  const coverage = {
    aLevelRows: aLevelRows.length,
    detailRows: detailRows.length,
    reviewRows: reviewRows.length,
    poiCount: pois.length,
    cityCount: cities.length,
    hotelCount: hotels.length,
    reviewCount: reviews.length,
    imageBindingCount: imageItems.length,
    clientPoiCount: clientPois.length,
  }

  writeJson(path.join(NORMALIZED_DIR, "coverage.json"), coverage)

  writeFileSync(
    path.join(NORMALIZED_DIR, "_build-meta.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceFiles: {
          aLevel: path.relative(ROOT_DIR, RAW_FILES.aLevel),
          detail: path.relative(ROOT_DIR, RAW_FILES.detail),
          reviews: path.relative(ROOT_DIR, RAW_FILES.reviews),
          poiImages: existsSync(RAW_FILES.poiImages)
            ? path.relative(ROOT_DIR, RAW_FILES.poiImages)
            : null,
        },
        coverage,
      },
      null,
      2
    )}\n`,
    "utf8"
  )

  console.log("旅游数据构建完成：", coverage)
}

run()
