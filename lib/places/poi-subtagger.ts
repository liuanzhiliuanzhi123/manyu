import {
  SUB_TAGS_BY_ROOT,
  type AmapPoiInput,
  type BeijingPoiRootCategory,
  type BeijingPoiSubTag,
} from "@/lib/places/poi-types"

interface SubTagInput extends Pick<AmapPoiInput, "name" | "type" | "typecode" | "address" | "business_area"> {
  rootCategory?: BeijingPoiRootCategory
  district?: string
  businessArea?: string
  rating?: number
  price?: number
  tags?: string[]
}

function toText(value: unknown) {
  if (Array.isArray(value)) return value.join(" ")
  return String(value || "").trim()
}

function sourceText(input: SubTagInput) {
  return [
    input.name,
    input.type,
    input.typecode,
    toText(input.address),
    input.district,
    input.businessArea,
    input.business_area,
    ...(input.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
}

function pushUnique(bucket: BeijingPoiSubTag[], tag: BeijingPoiSubTag) {
  if (!bucket.includes(tag)) bucket.push(tag)
}

function scenicSubTags(input: SubTagInput, text: string): BeijingPoiSubTag[] {
  const tags: BeijingPoiSubTag[] = []

  if (/公园|园林|湖|山|森林|湿地|长城|自然|绿地|植物园|动物园/u.test(text)) {
    pushUnique(tags, "nature")
  }
  if (/故宫|天坛|颐和园|圆明园|文物|文化|古迹|历史|胡同|国子监|孔庙|名胜|世界遗产|前门|大栅栏/u.test(text)) {
    pushUnique(tags, "culture")
  }
  if (/故宫|天安门|颐和园|长城|天坛|环球度假区|鸟巢|国家博物馆|前门|南锣鼓巷|热门|必去/u.test(text) || (input.rating || 0) >= 4.7) {
    pushUnique(tags, "popular")
  }
  if (/博物馆|纪念馆|展览馆|美术馆|科技馆|展览|展厅/u.test(text)) {
    pushUnique(tags, "museum")
  }
  if (/寺|庙|宫|坛|观|雍和宫|白云观|孔庙/u.test(text)) {
    pushUnique(tags, "temple")
  }
  if (/胡同|街|巷|前门|什刹海|三里屯|798|大栅栏|城市漫步|Citywalk|citywalk/u.test(text)) {
    pushUnique(tags, "citywalk")
  }
  if (/亲子|儿童|动物园|海洋馆|科技馆|游乐|公园|环球|植物园|家庭/u.test(text)) {
    pushUnique(tags, "familyFriendly")
  }
  if (/夜景|夜游|酒吧|三里屯|什刹海|奥林匹克|鸟巢|国贸|亮马河|夜生活/u.test(text)) {
    pushUnique(tags, "nightView")
  }
  if (/剧院|演出|剧场|相声|大剧院|音乐厅|展演|脱口秀/u.test(text)) {
    pushUnique(tags, "performance")
  }
  if (tags.length <= 1 && !tags.includes("popular") && (input.rating || 0) < 4.5) {
    pushUnique(tags, "hiddenGem")
  }

  return tags.length ? tags : ["culture"]
}

function foodSubTags(input: SubTagInput, text: string): BeijingPoiSubTag[] {
  const tags: BeijingPoiSubTag[] = []
  const price = input.price || 0

  if ((input.rating || 0) >= 4.6 || /热门|排队|网红|必吃|四季民福|全聚德|便宜坊|聚宝源|局气/u.test(text)) {
    pushUnique(tags, "popularFood")
  }
  if (/北京|京味|老北京|本地|卤煮|豆汁|炒肝|炸酱面|涮肉|爆肚|烤鸭/u.test(text)) {
    pushUnique(tags, "localSpecialty")
  }
  if (/清真|牛街|涮肉|聚宝源|羊肉/u.test(text)) {
    pushUnique(tags, "halal")
  }
  if (/北京菜|京菜|京味|老北京|炸酱面|卤煮|豆汁|炒肝|爆肚|烤鸭/u.test(text)) {
    pushUnique(tags, "beijingCuisine")
  }
  if (/烤鸭|全聚德|四季民福|便宜坊|大董|鸭/u.test(text)) {
    pushUnique(tags, "pekingDuck")
  }
  if (/小吃|简餐|面|包子|豆汁|卤煮|炸酱|烧饼|护国寺|点心|快餐/u.test(text)) {
    pushUnique(tags, "snack")
  }
  if (/火锅|涮肉|锅/u.test(text)) {
    pushUnique(tags, "hotpot")
  }
  if (/咖啡|甜品|茶|面包|蛋糕|烘焙/u.test(text)) {
    pushUnique(tags, "cafeDessert")
  }
  if (/夜宵|烧烤|小龙虾|酒馆|深夜|簋街|东直门|夜间/u.test(text)) {
    pushUnique(tags, "lateNightFood")
  }
  if (price > 0 && price <= 90) {
    pushUnique(tags, "valueFood")
  }

  return tags.length ? tags : ["popularFood"]
}

function hotelSubTags(input: SubTagInput, text: string): BeijingPoiSubTag[] {
  const tags: BeijingPoiSubTag[] = []
  const price = input.price || 0

  if (/五星|5星|豪华|奢华|文华东方|丽思|柏悦|瑰丽|华尔道夫|四季/u.test(text) || price >= 1600) {
    pushUnique(tags, "fiveStar")
    pushUnique(tags, "luxuryHotel")
  } else if (/四星|4星|高档/u.test(text) || price >= 800) {
    pushUnique(tags, "fourStar")
    pushUnique(tags, "comfortHotel")
  } else if (/三星|3星|经济|快捷|如家|汉庭|全季|桔子|亚朵/u.test(text) || (price > 0 && price < 500)) {
    pushUnique(tags, "threeStarOrBelow")
    pushUnique(tags, "budgetHotel")
  }

  if (price > 0 && price <= 500) {
    pushUnique(tags, "budgetHotel")
  }
  if (price >= 500 && price < 1600) {
    pushUnique(tags, "comfortHotel")
  }
  if (/家庭|亲子|公寓|套房|度假|儿童/u.test(text)) {
    pushUnique(tags, "familyHotel")
  }
  if (/地铁|站|交通便利|近地铁|号线|步行/u.test(text)) {
    pushUnique(tags, "nearMetro")
  }
  if (
    input.businessArea ||
    input.business_area ||
    /国贸|CBD|王府井|前门|望京|中关村|三里屯|西单|金融街|商圈|商务/u.test(text)
  ) {
    pushUnique(tags, "businessAreaHotel")
  }

  return tags.length ? tags : ["comfortHotel"]
}

export function buildPoiSubTags(
  input: SubTagInput,
  rootCategory: BeijingPoiRootCategory = input.rootCategory || "scenic"
): BeijingPoiSubTag[] {
  const text = sourceText(input)
  const tags =
    rootCategory === "food"
      ? foodSubTags(input, text)
      : rootCategory === "hotel"
        ? hotelSubTags(input, text)
        : scenicSubTags(input, text)

  const allowed = new Set<BeijingPoiSubTag>(SUB_TAGS_BY_ROOT[rootCategory])
  return tags.filter((tag) => allowed.has(tag)).slice(0, 5)
}
