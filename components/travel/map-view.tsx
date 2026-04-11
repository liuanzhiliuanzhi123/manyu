"use client"

import { useEffect, useRef, useState } from "react"
import { SpotData } from "./spot-card"
import { Car, Bus, Footprints, Clock, MapPin, Route } from "lucide-react"

interface MapViewProps {
  spots: SpotData[]
}

const markerColors = ["#4A6CF7", "#7B61FF", "#22C55E", "#EF4444", "#F59E0B", "#06B6D4", "#EC4899"]

// 模拟景点经纬度数据
const spotCoordinates: Record<string, [number, number]> = {
  "1": [116.397428, 39.90923], // 故宫
  "2": [116.403834, 39.881661], // 天坛
  "3": [116.275175, 39.998344], // 颐和园
  "4": [116.020384, 40.359841], // 八达岭长城
  "5": [116.416316, 39.912851], // 大董烤鸭店
  "6": [116.407841, 39.915749], // 王府井
  "7": [116.322841, 39.983415], // 圆明园
  "8": [116.305078, 39.991648], // 北京大学
  "9": [116.358611, 39.930763], // 雍和宫
  "10": [116.36617, 39.912753] // 南锣鼓巷
}

export function MapView({ spots }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [transportMode, setTransportMode] = useState<'driving' | 'transit' | 'walking'>('driving')
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)

  // 获取景点坐标
  const getSpotCoordinate = (spotId: string, index: number): [number, number] => {
    return spotCoordinates[spotId] || [116.3 + (index * 0.1) % 0.6, 39.85 + (index * 0.1) % 0.2]
  }

  // 规划路线
  const planRoute = (map: any, spots: SpotData[]) => {
    if (spots.length < 2) return

    // 清除现有路线
    map.clearMap()

    // 添加标记点
    const coordinates: [number, number][] = []
    spots.forEach((spot, index) => {
      const coordinate = getSpotCoordinate(spot.id, index)
      coordinates.push(coordinate)

      // 创建标记
      const marker = new window.AMap.Marker({
        position: coordinate,
        title: spot.name,
        icon: new window.AMap.Icon({
          size: new window.AMap.Size(30, 30),
          image: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="15" fill="${markerColors[index % markerColors.length]}"/><text x="15" y="19" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${index + 1}</text></svg>`
        })
      })

      // 添加标记到地图
      marker.setMap(map)

      // 添加点击事件
      marker.on('click', () => {
        console.log('点击了标记:', spot.name)
      })
    })

    // 调整地图视野以包含所有标记
    const bounds = new window.AMap.Bounds()
    coordinates.forEach(coord => bounds.extend(coord))
    map.setBounds(bounds, true)

    // 加载路线规划插件
    window.AMap.plugin([`AMap.${transportMode.charAt(0).toUpperCase() + transportMode.slice(1)}`], () => {
      let planner: any

      switch (transportMode) {
        case 'driving':
          planner = new window.AMap.Driving({
            map: map,
            panel: 'panel',
            policy: window.AMap.DrivingPolicy.LEAST_TIME
          })
          break
        case 'transit':
          planner = new window.AMap.Transit({
            map: map,
            panel: 'panel'
          })
          break
        case 'walking':
          planner = new window.AMap.Walking({
            map: map,
            panel: 'panel'
          })
          break
      }

      // 规划路线
      if (planner) {
        const start = coordinates[0]
        const end = coordinates[coordinates.length - 1]
        const waypoints = coordinates.slice(1, -1).map(coord => ({ lnglat: coord }))

        planner.search(start, end, waypoints, (status: string, result: any) => {
          if (status === 'complete') {
            const route = result.routes[0]
            setRouteInfo({
              distance: route.distance + ' 米',
              duration: Math.round(route.duration / 60) + ' 分钟'
            })
          } else {
            console.error('路线规划失败:', result)
          }
        })
      }
    })
  }

  useEffect(() => {
    // 检查高德地图 API 是否加载
    if (typeof window !== 'undefined' && window.AMap) {
      // 初始化地图
      const map = new window.AMap.Map(mapRef.current!, {
        center: [116.404, 39.915], // 北京中心点
        zoom: 12,
        resizeEnable: true
      })

      setMapInstance(map)

      // 规划路线
      planRoute(map, spots)

      // 清理函数
      return () => {
        map.destroy()
      }
    }
  }, [spots])

  // 当交通方式变化时重新规划路线
  useEffect(() => {
    if (mapInstance && spots.length > 1) {
      planRoute(mapInstance, spots)
    }
  }, [transportMode, mapInstance, spots])

  return (
    <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-4 flex-1">
      {/* 交通方式选择 */}
      {spots.length > 1 && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg text-[#1E293B]">路线规划</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setTransportMode('driving')}
              className={`p-2 rounded-lg flex flex-col items-center justify-center ${transportMode === 'driving' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}
            >
              <Car className="w-4 h-4 mb-1" />
              <span className="text-xs">驾车</span>
            </button>
            <button
              onClick={() => setTransportMode('transit')}
              className={`p-2 rounded-lg flex flex-col items-center justify-center ${transportMode === 'transit' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}
            >
              <Bus className="w-4 h-4 mb-1" />
              <span className="text-xs">公交</span>
            </button>
            <button
              onClick={() => setTransportMode('walking')}
              className={`p-2 rounded-lg flex flex-col items-center justify-center ${transportMode === 'walking' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}
            >
              <Footprints className="w-4 h-4 mb-1" />
              <span className="text-xs">步行</span>
            </button>
          </div>
        </div>
      )}

      {/* 路线信息 */}
      {routeInfo && (
        <div className="flex justify-between items-center mb-4 p-3 bg-secondary rounded-lg">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">{spots.length} 个景点</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-sm">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{routeInfo.duration}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{routeInfo.distance}</span>
            </div>
          </div>
        </div>
      )}

      {/* 地图容器 */}
      <div className="relative">
        <div 
          ref={mapRef} 
          className="w-full rounded-lg overflow-hidden"
          style={{ height: '400px' }}
        >
          {spots.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[#64748B] text-[12px] bg-white">
              添加行程点后显示地图标记
            </div>
          )}
        </div>

        {/* 路线详情面板 */}
        {spots.length > 1 && (
          <div 
            id="panel" 
            className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto"
          ></div>
        )}
      </div>
    </div>
  )
}
