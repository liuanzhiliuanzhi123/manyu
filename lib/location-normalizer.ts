const MUNICIPALITIES = new Set(["北京", "上海", "天津", "重庆"])
const SPECIAL_REGIONS = new Set(["香港", "澳门"])

const PROVINCE_LIST = [
  "北京",
  "天津",
  "上海",
  "重庆",
  "河北",
  "山西",
  "辽宁",
  "吉林",
  "黑龙江",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "海南",
  "四川",
  "贵州",
  "云南",
  "陕西",
  "甘肃",
  "青海",
  "台湾",
  "内蒙古",
  "广西",
  "西藏",
  "宁夏",
  "新疆",
  "香港",
  "澳门",
] as const

const PROVINCE_SET = new Set<string>(PROVINCE_LIST)

const PROVINCE_ALIAS_MAP = new Map<string, string>([
  ["北京市", "北京"],
  ["天津市", "天津"],
  ["上海市", "上海"],
  ["重庆市", "重庆"],
  ["河北省", "河北"],
  ["山西省", "山西"],
  ["辽宁省", "辽宁"],
  ["吉林省", "吉林"],
  ["黑龙江省", "黑龙江"],
  ["江苏省", "江苏"],
  ["浙江省", "浙江"],
  ["安徽省", "安徽"],
  ["福建省", "福建"],
  ["江西省", "江西"],
  ["山东省", "山东"],
  ["河南省", "河南"],
  ["湖北省", "湖北"],
  ["湖南省", "湖南"],
  ["广东省", "广东"],
  ["海南省", "海南"],
  ["四川省", "四川"],
  ["贵州省", "贵州"],
  ["云南省", "云南"],
  ["陕西省", "陕西"],
  ["甘肃省", "甘肃"],
  ["青海省", "青海"],
  ["台湾省", "台湾"],
  ["内蒙古自治区", "内蒙古"],
  ["广西壮族自治区", "广西"],
  ["西藏自治区", "西藏"],
  ["宁夏回族自治区", "宁夏"],
  ["新疆维吾尔自治区", "新疆"],
  ["香港特别行政区", "香港"],
  ["澳门特别行政区", "澳门"],
])

export function isNumericLike(value: string) {
  const text = value.trim()
  if (!text) return false
  return /^[-+]?\d+(?:\.\d+)?$/u.test(text)
}

function trimSuffix(value: string) {
  return value
    .trim()
    .replace(/[（(].*?[）)]/gu, "")
    .replace(/特别行政区$/u, "")
    .replace(/维吾尔自治区$/u, "")
    .replace(/回族自治区$/u, "")
    .replace(/壮族自治区$/u, "")
    .replace(/自治区$/u, "")
    .replace(/自治州$/u, "")
    .replace(/地区$/u, "")
    .replace(/省$/u, "")
    .replace(/市$/u, "")
}

export function sanitizeProvinceName(rawValue: string) {
  const value = rawValue.trim()
  if (!value || isNumericLike(value)) return ""

  const aliasHit = PROVINCE_ALIAS_MAP.get(value)
  if (aliasHit) return aliasHit

  const simplified = trimSuffix(value)
  if (PROVINCE_SET.has(simplified)) return simplified

  for (const province of PROVINCE_LIST) {
    if (value.includes(province)) return province
  }
  return ""
}

export function sanitizeCityName(rawValue: string) {
  const value = rawValue.trim()
  if (!value || isNumericLike(value)) return ""
  const simplified = trimSuffix(value)
  if (!simplified || isNumericLike(simplified)) return ""
  return simplified
}

export function isValidProvinceName(province: string) {
  return PROVINCE_SET.has(province.trim())
}

export function isMunicipality(cityOrProvince: string) {
  return MUNICIPALITIES.has(cityOrProvince.trim())
}

export function isSpecialRegion(cityOrProvince: string) {
  return SPECIAL_REGIONS.has(cityOrProvince.trim())
}

export function normalizeAdminPair(input: {
  province?: string
  city?: string
  address?: string
}) {
  let province = sanitizeProvinceName(input.province ?? "")
  let city = sanitizeCityName(input.city ?? "")

  if (!province || !city) {
    const inferred = inferFromAddress(input.address ?? "")
    if (!province) province = inferred.province
    if (!city) city = inferred.city
  }

  if (isSpecialRegion(city)) {
    province = city
  } else if (isSpecialRegion(province)) {
    city = province
  }

  if (isMunicipality(city)) {
    province = city
  } else if (isMunicipality(province) && !city) {
    city = province
  }

  return { province, city }
}

export function inferFromAddress(address: string) {
  const text = address.trim()
  if (!text) return { province: "", city: "" }

  const provinceMatch = text.match(
    /([\u4e00-\u9fa5]{2,9})(省|自治区|特别行政区)/u
  )
  const cityMatch = text.match(/([\u4e00-\u9fa5]{2,9})(市|地区|自治州)/u)

  const province = sanitizeProvinceName(provinceMatch?.[0] ?? "")
  const city = sanitizeCityName(cityMatch?.[0] ?? "")

  if (city && (isMunicipality(city) || isSpecialRegion(city))) {
    return { province: city, city }
  }
  if (province && (isMunicipality(province) || isSpecialRegion(province)) && !city) {
    return { province, city: province }
  }

  return { province, city }
}

export function getProvinceList() {
  return [...PROVINCE_LIST]
}

