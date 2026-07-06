import { describe, expect, it } from "vitest"
import { normalizeAmapPoiToBeijingPoi } from "../lib/amap/poi-importer"
import { buildBeijingPlannerCandidates } from "../lib/planner/beijing-planner-context"
import { classifyPoiRootCategory } from "../lib/places/poi-classifier"
import { filterBeijingPois } from "../lib/places/poi-filter"
import { beijingPoiToSpot, getPoiImageFallback } from "../lib/places/beijing-poi-data"
import { buildPoiSubTags } from "../lib/places/poi-subtagger"
import type { BeijingPoi } from "../lib/places/poi-types"

function poi(overrides: Partial<BeijingPoi> & Pick<BeijingPoi, "id" | "name" | "rootCategory">): BeijingPoi {
  return {
    province: "北京",
    city: "北京",
    district: "东城区",
    address: "北京市东城区",
    rating: 4.6,
    price: 0,
    tags: [],
    subTags: [],
    intro: "北京测试 POI",
    source: "amap",
    imageSource: "placeholder",
    confidence: 90,
    ...overrides,
  }
}

describe("Beijing POI classification", () => {
  it("classifies the three root categories from AMap typecode", () => {
    expect(
      classifyPoiRootCategory({
        name: "故宫博物院",
        type: "风景名胜;风景名胜;国家级景点",
        typecode: "110000",
      }).rootCategory
    ).toBe("scenic")
    expect(
      classifyPoiRootCategory({
        name: "四季民福烤鸭店",
        type: "餐饮服务;中餐厅",
        typecode: "050100",
      }).rootCategory
    ).toBe("food")
    expect(
      classifyPoiRootCategory({
        name: "北京王府井希尔顿酒店",
        type: "住宿服务;宾馆酒店",
        typecode: "100100",
      }).rootCategory
    ).toBe("hotel")
  })

  it("does not promote restaurants or hotels into scenic candidates", () => {
    expect(
      classifyPoiRootCategory({
        name: "故宫角楼咖啡",
        type: "餐饮服务;咖啡厅",
        typecode: "050500",
      }).rootCategory
    ).toBe("food")
    expect(
      classifyPoiRootCategory({
        name: "北京前门文华东方酒店",
        type: "住宿服务;宾馆酒店",
        typecode: "100100",
      }).rootCategory
    ).toBe("hotel")
  })
})

describe("Beijing POI subtags and filters", () => {
  it("assigns category-specific subtags", () => {
    expect(
      buildPoiSubTags(
        {
          name: "中国国家博物馆",
          type: "科教文化服务;博物馆",
          typecode: "140100",
          rating: 4.8,
        },
        "scenic"
      )
    ).toEqual(expect.arrayContaining(["museum", "culture", "popular"]))
    expect(
      buildPoiSubTags(
        {
          name: "四季民福烤鸭店",
          type: "餐饮服务;中餐厅",
          typecode: "050100",
          price: 168,
        },
        "food"
      )
    ).toEqual(expect.arrayContaining(["pekingDuck", "beijingCuisine"]))
    expect(
      buildPoiSubTags(
        {
          name: "北京前门文华东方酒店",
          type: "住宿服务;宾馆酒店",
          typecode: "100100",
          price: 3200,
          businessArea: "前门",
        },
        "hotel"
      )
    ).toEqual(expect.arrayContaining(["fiveStar", "luxuryHotel", "businessAreaHotel"]))
  })

  it("keeps root-category filtering strict", () => {
    const pois = [
      poi({ id: "scenic-1", name: "故宫博物院", rootCategory: "scenic", subTags: ["museum"] }),
      poi({ id: "food-1", name: "四季民福烤鸭店", rootCategory: "food", subTags: ["pekingDuck"], price: 168 }),
      poi({ id: "hotel-1", name: "北京王府井酒店", rootCategory: "hotel", subTags: ["comfortHotel"], price: 980 }),
    ]

    expect(filterBeijingPois(pois, { rootCategory: "scenic" }).map((item) => item.id)).toEqual([
      "scenic-1",
    ])
    expect(filterBeijingPois(pois, { rootCategory: "food", subTag: "pekingDuck" })).toHaveLength(1)
    expect(filterBeijingPois(pois, { rootCategory: "scenic", subTag: "pekingDuck" })).toHaveLength(0)
  })
})

describe("Beijing POI import and planner linkage", () => {
  it("normalizes AMap POIs with AMap photos first", () => {
    const normalized = normalizeAmapPoiToBeijingPoi(
      {
        id: "B000A8UIN8",
        name: "故宫博物院",
        type: "风景名胜;风景名胜;国家级景点",
        typecode: "110000",
        pname: "北京市",
        cityname: "北京市",
        adname: "东城区",
        adcode: "110101",
        address: "景山前街4号",
        location: "116.397477,39.916345",
        biz_ext: { rating: "4.9", cost: "60" },
        photos: [{ title: "外观", url: "https://example.com/forbidden-city.jpg" }],
      },
      "scenic",
      "2026-07-06T00:00:00.000Z"
    )

    expect(normalized.poi?.rootCategory).toBe("scenic")
    expect(normalized.poi?.imageSource).toBe("amap")
    expect(normalized.poi?.imageUrl).toBe("https://example.com/forbidden-city.jpg")
    expect(normalized.poi?.subTags).toEqual(expect.arrayContaining(["culture"]))
  })

  it("falls back to category placeholders when no image is available", () => {
    const food = poi({ id: "food-no-image", name: "北京小吃", rootCategory: "food" })
    const image = getPoiImageFallback(food)
    expect(image.src).toBe("/images/places/placeholders/food.jpg")
    expect(image.confidence).toBe("fallback")

    const spot = beijingPoiToSpot({
      ...food,
      imageUrl: "https://example.com/food.jpg",
      imageSource: "amap",
    })
    expect(spot.image).toBe("https://example.com/food.jpg")
    expect(spot.type).toBe("restaurant")
  })

  it("builds separated planner candidate pools", () => {
    const context = buildBeijingPlannerCandidates({
      attractionLimit: 20,
      restaurantLimit: 20,
      hotelLimit: 20,
    })

    expect(context.attractions.length).toBeGreaterThan(0)
    expect(context.restaurants.length).toBeGreaterThan(0)
    expect(context.hotels.length).toBeGreaterThan(0)
    expect(context.attractions.every((item) => item.type === "attraction")).toBe(true)
    expect(context.restaurants.every((item) => item.type === "restaurant")).toBe(true)
    expect(context.hotels.every((item) => item.type === "hotel")).toBe(true)
  })
})
