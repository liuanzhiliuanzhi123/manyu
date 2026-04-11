"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import { searchCozeDatabase } from "./coze-api"

export interface Spot {
  id: string
  name: string
  type: "attraction" | "restaurant" | "hotel"
  address: string
  rating: number
  heat: number
  ticketPrice: number
  description: string
  image: string
  tags: string[]
  openTime?: string
  phone?: string
}

export interface TripPlan {
  id: string
  name: string
  startDate: string
  endDate: string
  pace: string
  departure: string
  spots: Spot[]
  createdAt: string
}

interface TravelContextType {
  selectedSpots: Spot[]
  addSpot: (spot: Spot) => void
  removeSpot: (id: string) => void
  clearSpots: () => void
  savedPlans: TripPlan[]
  savePlan: (plan: TripPlan) => void
  deletePlan: (id: string) => void
  currentPlan: TripPlan | null
  setCurrentPlan: (plan: TripPlan | null) => void
  favorites: string[]
  toggleFavorite: (id: string) => void
  searchResults: Spot[]
  isSearching: boolean
  searchSpots: (query: string) => Promise<void>
}

const TravelContext = createContext<TravelContextType | undefined>(undefined)

// 示例景点数据
export const sampleSpots: Spot[] = [
  {
    id: "1",
    name: "故宫博物院",
    type: "attraction",
    address: "北京市东城区景山前街4号",
    rating: 4.9,
    heat: 98,
    ticketPrice: 60,
    description: "明清两代的皇家宫殿，世界上现存规模最大、保存最为完整的木质结构古建筑群。",
    image: "https://images.unsplash.com/photo-1584646098378-0874589d76b1?w=800&q=80",
    tags: ["历史文化", "世界遗产", "必游"],
    openTime: "08:30-17:00",
    phone: "010-85007421"
  },
  {
    id: "2",
    name: "颐和园",
    type: "attraction",
    address: "北京市海淀区新建宫门路19号",
    rating: 4.8,
    heat: 95,
    ticketPrice: 30,
    description: "中国现存规模最大、保存最完整的皇家园林，被誉为皇家园林博物馆。",
    image: "https://images.unsplash.com/photo-1599571234909-29ed5d1321d6?w=800&q=80",
    tags: ["皇家园林", "世界遗产", "亲子"],
    openTime: "06:30-18:00",
    phone: "010-62881144"
  },
  {
    id: "3",
    name: "长城·八达岭",
    type: "attraction",
    address: "北京市延庆区八达岭镇",
    rating: 4.9,
    heat: 99,
    ticketPrice: 40,
    description: "万里长城的精华所在，是中华民族的象征，也是世界文化遗产。",
    image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&q=80",
    tags: ["世界遗产", "必游", "户外"],
    openTime: "07:30-17:30",
    phone: "010-69121268"
  },
  {
    id: "4",
    name: "全聚德烤鸭店",
    type: "restaurant",
    address: "北京市东城区前门大街30号",
    rating: 4.6,
    heat: 92,
    ticketPrice: 200,
    description: "创建于1864年的老字号，北京烤鸭的代表，享誉海内外。",
    image: "https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=800&q=80",
    tags: ["老字号", "烤鸭", "美食"],
    openTime: "11:00-21:00",
    phone: "010-67011379"
  },
  {
    id: "5",
    name: "南锣鼓巷",
    type: "attraction",
    address: "北京市东城区南锣鼓巷",
    rating: 4.5,
    heat: 88,
    ticketPrice: 0,
    description: "北京最古老的街区之一，充满文艺气息的胡同，汇聚特色小店和美食。",
    image: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&q=80",
    tags: ["胡同文化", "免费", "美食"],
    openTime: "全天开放",
    phone: ""
  },
  {
    id: "6",
    name: "天坛公园",
    type: "attraction",
    address: "北京市东城区天坛东里甲1号",
    rating: 4.8,
    heat: 93,
    ticketPrice: 15,
    description: "明清两代帝王祭祀天地之所，是中国现存最大的古代祭祀性建筑群。",
    image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80",
    tags: ["世界遗产", "古建筑", "祈福"],
    openTime: "06:00-21:00",
    phone: "010-67028866"
  },
  {
    id: "7",
    name: "北京饭店",
    type: "hotel",
    address: "北京市东城区东长安街33号",
    rating: 4.7,
    heat: 85,
    ticketPrice: 800,
    description: "始建于1900年的百年老店，见证了近代中国历史的变迁。",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    tags: ["五星级", "历史酒店", "地段优越"],
    openTime: "24小时",
    phone: "010-65137766"
  },
  {
    id: "8",
    name: "什刹海",
    type: "attraction",
    address: "北京市西城区什刹海景区",
    rating: 4.6,
    heat: 90,
    ticketPrice: 0,
    description: "北京城内最具水乡风韵的地方，夏日荷花盛开，冬日滑冰嬉戏。",
    image: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80",
    tags: ["免费", "夜景", "休闲"],
    openTime: "全天开放",
    phone: ""
  }
]

export function TravelProvider({ children }: { children: ReactNode }) {
  const [selectedSpots, setSelectedSpots] = useState<Spot[]>([])
  const [savedPlans, setSavedPlans] = useState<TripPlan[]>([])
  const [currentPlan, setCurrentPlan] = useState<TripPlan | null>(null)
  const [favorites, setFavorites] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<Spot[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const addSpot = (spot: Spot) => {
    if (!selectedSpots.find((s) => s.id === spot.id)) {
      setSelectedSpots([...selectedSpots, spot])
    }
  }

  const removeSpot = (id: string) => {
    setSelectedSpots(selectedSpots.filter((s) => s.id !== id))
  }

  const clearSpots = () => {
    setSelectedSpots([])
  }

  const savePlan = (plan: TripPlan) => {
    setSavedPlans([...savedPlans, plan])
  }

  const deletePlan = (id: string) => {
    setSavedPlans(savedPlans.filter((p) => p.id !== id))
  }

  const toggleFavorite = (id: string) => {
    if (favorites.includes(id)) {
      setFavorites(favorites.filter((f) => f !== id))
    } else {
      setFavorites([...favorites, id])
    }
  }

  const searchSpots = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await searchCozeDatabase(query)
      // 转换结果为 Spot 类型
      const spots = results.map((item: any) => ({
        id: item.id || `coze-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: item.name || item.title || "未知景点",
        type: (item.type || "attraction").toLowerCase() as "attraction" | "restaurant" | "hotel",
        address: item.address || item.location || "未知地址",
        rating: item.rating || 4.0,
        heat: item.heat || 50,
        ticketPrice: item.ticketPrice || item.price || 0,
        description: item.description || item.content || "暂无描述",
        image: item.image || item.photo || "https://placehold.co/600x400?text=No+Image",
        tags: item.tags || item.keywords || [],
        openTime: item.openTime || item.openingHours || "",
        phone: item.phone || item.contact || ""
      }))
      setSearchResults(spots)
    } catch (error) {
      console.error("搜索失败:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <TravelContext.Provider
      value={{
        selectedSpots,
        addSpot,
        removeSpot,
        clearSpots,
        savedPlans,
        savePlan,
        deletePlan,
        currentPlan,
        setCurrentPlan,
        favorites,
        toggleFavorite,
        searchResults,
        isSearching,
        searchSpots,
      }}
    >
      {children}
    </TravelContext.Provider>
  )
}

export function useTravel() {
  const context = useContext(TravelContext)
  if (context === undefined) {
    throw new Error("useTravel must be used within a TravelProvider")
  }
  return context
}
