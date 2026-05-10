export type PlaceRegion = "domestic" | "asia" | "europe" | "unknown"

type PlaceLike = {
  continent?: unknown
  region?: unknown
  country?: unknown
  province?: unknown
  city?: unknown
  address?: unknown
  tags?: unknown
}

const mainlandCountryTerms = ["中国", "中华人民共和国", "中国大陆", "大陆", "china", "prc"]

const nonMainlandChinaTerms = [
  "香港",
  "澳门",
  "台湾",
  "台北",
  "新北",
  "台中",
  "台南",
  "高雄",
  "hong kong",
  "macau",
  "taiwan",
  "taipei",
]

const mainlandTerms = [
  "北京",
  "上海",
  "广州",
  "深圳",
  "杭州",
  "成都",
  "西安",
  "南京",
  "苏州",
  "重庆",
  "天津",
  "武汉",
  "长沙",
  "厦门",
  "青岛",
  "昆明",
  "大理",
  "丽江",
  "三亚",
  "哈尔滨",
  "沈阳",
  "郑州",
  "洛阳",
  "济南",
  "福州",
  "宁波",
  "无锡",
  "合肥",
  "南昌",
  "南宁",
  "贵阳",
  "海口",
  "兰州",
  "银川",
  "西宁",
  "乌鲁木齐",
  "呼和浩特",
  "石家庄",
  "太原",
  "长春",
  "北京",
  "上海",
  "天津",
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
  "广西",
  "内蒙古",
  "宁夏",
  "新疆",
  "西藏",
]

const asiaCountryTerms = [
  "日本",
  "韩国",
  "泰国",
  "新加坡",
  "马来西亚",
  "越南",
  "印度尼西亚",
  "阿联酋",
  "阿拉伯联合酋长国",
  "菲律宾",
  "柬埔寨",
  "老挝",
  "缅甸",
  "印度",
  "斯里兰卡",
  "卡塔尔",
  "土耳其",
  "japan",
  "korea",
  "thailand",
  "singapore",
  "malaysia",
  "vietnam",
  "indonesia",
  "uae",
  "emirates",
]

const asiaCityTerms = [
  "东京",
  "大阪",
  "京都",
  "札幌",
  "首尔",
  "釜山",
  "曼谷",
  "清迈",
  "新加坡",
  "吉隆坡",
  "槟城",
  "巴厘岛",
  "迪拜",
  "阿布扎比",
  "河内",
  "胡志明市",
  "马尼拉",
  "暹粒",
  "万象",
  "仰光",
  "孟买",
  "德里",
  "科伦坡",
  "多哈",
  "伊斯坦布尔",
  "tokyo",
  "osaka",
  "kyoto",
  "seoul",
  "bangkok",
  "singapore",
  "kuala lumpur",
  "bali",
  "dubai",
]

const europeCountryTerms = [
  "法国",
  "英国",
  "意大利",
  "西班牙",
  "德国",
  "瑞士",
  "奥地利",
  "荷兰",
  "葡萄牙",
  "希腊",
  "捷克",
  "比利时",
  "丹麦",
  "瑞典",
  "挪威",
  "芬兰",
  "冰岛",
  "爱尔兰",
  "france",
  "uk",
  "united kingdom",
  "italy",
  "spain",
  "germany",
  "switzerland",
  "austria",
  "netherlands",
]

const europeCityTerms = [
  "巴黎",
  "伦敦",
  "罗马",
  "米兰",
  "佛罗伦萨",
  "威尼斯",
  "巴塞罗那",
  "马德里",
  "柏林",
  "慕尼黑",
  "阿姆斯特丹",
  "苏黎世",
  "日内瓦",
  "维也纳",
  "布拉格",
  "里斯本",
  "雅典",
  "布鲁塞尔",
  "哥本哈根",
  "斯德哥尔摩",
  "奥斯陆",
  "赫尔辛基",
  "雷克雅未克",
  "都柏林",
  "paris",
  "london",
  "rome",
  "milan",
  "florence",
  "venice",
  "barcelona",
  "madrid",
  "berlin",
  "munich",
  "amsterdam",
  "zurich",
  "vienna",
  "prague",
]

function stringifyField(value: unknown): string {
  if (Array.isArray(value)) return value.map(stringifyField).join(" ")
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ")
}

function hasAnyTerm(source: string, terms: string[]): boolean {
  const normalized = normalizeText(source)
  return terms.some((term) => normalized.includes(normalizeText(term)))
}

function classifyContinentOrRegion(text: string, place: PlaceLike): PlaceRegion | null {
  if (!text) return null
  if (hasAnyTerm(text, nonMainlandChinaTerms)) return "asia"
  if (hasAnyTerm(text, ["欧洲", "europe"])) return "europe"
  if (hasAnyTerm(text, ["亚洲", "asia"])) {
    const country = stringifyField(place.country)
    const province = stringifyField(place.province)
    const city = stringifyField(place.city)
    const address = stringifyField(place.address)
    const mainlandSource = [country, province, city, address].join(" ")
    if (hasAnyTerm(mainlandSource, nonMainlandChinaTerms)) return "asia"
    if (hasAnyTerm(country, mainlandCountryTerms) || hasAnyTerm([province, city, address].join(" "), mainlandTerms)) {
      return "domestic"
    }
    return "asia"
  }
  if (hasAnyTerm(text, ["国内", "中国大陆", ...mainlandCountryTerms, ...mainlandTerms])) return "domestic"
  return null
}

function classifyCountry(text: string): PlaceRegion | null {
  if (!text) return null
  if (hasAnyTerm(text, nonMainlandChinaTerms)) return "asia"
  if (hasAnyTerm(text, europeCountryTerms)) return "europe"
  if (hasAnyTerm(text, asiaCountryTerms)) return "asia"
  if (hasAnyTerm(text, mainlandCountryTerms)) return "domestic"
  return null
}

function classifyLocation(text: string): PlaceRegion | null {
  if (!text) return null
  if (hasAnyTerm(text, nonMainlandChinaTerms)) return "asia"
  if (hasAnyTerm(text, mainlandTerms)) return "domestic"
  if (hasAnyTerm(text, europeCountryTerms) || hasAnyTerm(text, europeCityTerms)) return "europe"
  if (hasAnyTerm(text, asiaCountryTerms) || hasAnyTerm(text, asiaCityTerms)) return "asia"
  return null
}

export function getPlaceRegion(place: PlaceLike): PlaceRegion {
  const continentResult = classifyContinentOrRegion(stringifyField(place.continent), place)
  if (continentResult) return continentResult

  const regionResult = classifyContinentOrRegion(stringifyField(place.region), place)
  if (regionResult) return regionResult

  const countryResult = classifyCountry(stringifyField(place.country))
  if (countryResult) return countryResult

  const provinceResult = classifyLocation(stringifyField(place.province))
  if (provinceResult) return provinceResult

  const cityResult = classifyLocation(stringifyField(place.city))
  if (cityResult) return cityResult

  const addressResult = classifyLocation(stringifyField(place.address))
  if (addressResult) return addressResult

  const tagsResult = classifyLocation(stringifyField(place.tags))
  if (tagsResult) return tagsResult

  return "unknown"
}

export function isDomesticPlace(place: PlaceLike): boolean {
  return getPlaceRegion(place) === "domestic"
}

export function isAsiaNonChinaPlace(place: PlaceLike): boolean {
  return getPlaceRegion(place) === "asia"
}

export function isEuropePlace(place: PlaceLike): boolean {
  return getPlaceRegion(place) === "europe"
}
