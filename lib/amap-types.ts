export type LngLatTuple = [number, number]

export interface AMapLngLatLike {
  lng?: number
  lat?: number
  getLng?: () => number
  getLat?: () => number
}

export interface AMapMapInstance {
  addControl: (control: unknown) => void
  add: (overlay: unknown | unknown[]) => void
  remove: (overlay: unknown | unknown[]) => void
  clearMap: () => void
  setCenter: (center: LngLatTuple) => void
  setZoom: (zoom: number) => void
  setFitView: (overlays?: unknown[]) => void
  resize: () => void
  on: (eventName: string, handler: (event?: unknown) => void) => void
  off: (eventName: string, handler: (event?: unknown) => void) => void
  destroy: () => void
}

export interface AMapBoundsInstance {
  extend: (position: LngLatTuple) => void
}

export interface AMapMarkerInstance {
  setMap: (map: AMapMapInstance | null) => void
  setPosition: (position: LngLatTuple) => void
  setContent?: (content: string | HTMLElement) => void
  setLabel?: (label: { content: string; direction?: "top" | "right" | "bottom" | "left"; offset?: unknown }) => void
  setzIndex?: (zIndex: number) => void
  getPosition?: () => unknown
  on?: (eventName: string, handler: (event?: unknown) => void) => void
  off?: (eventName: string, handler: (event?: unknown) => void) => void
}

export interface AMapPolylineInstance {
  setMap: (map: AMapMapInstance | null) => void
  setOptions?: (options: {
    strokeColor?: string
    strokeWeight?: number
    strokeOpacity?: number
    strokeStyle?: "solid" | "dashed"
  }) => void
  on?: (eventName: string, handler: (event?: unknown) => void) => void
  off?: (eventName: string, handler: (event?: unknown) => void) => void
}

export interface AMapRouteStep {
  path?: AMapLngLatLike[]
}

export interface AMapRoute {
  distance?: number
  time?: number
  duration?: number
  steps?: AMapRouteStep[]
}

export interface AMapRouteResult {
  routes?: AMapRoute[]
  info?: string
  message?: string
  infocode?: string
}

export type AMapServiceStatus = "complete" | "error" | "no_data"
export type AMapRouteSearchCallback = (
  status: AMapServiceStatus,
  result: AMapRouteResult
) => void

export interface AMapDrivingInstance {
  clear: () => void
  search: {
    (
      start: LngLatTuple,
      end: LngLatTuple,
      callback: AMapRouteSearchCallback
    ): void
    (
      start: LngLatTuple,
      end: LngLatTuple,
      options: { waypoints?: LngLatTuple[] },
      callback: AMapRouteSearchCallback
    ): void
  }
}

export interface AMapWalkingInstance {
  clear: () => void
  search: (
    start: LngLatTuple,
    end: LngLatTuple,
    callback: AMapRouteSearchCallback
  ) => void
}

export interface AMapTransferPlan {
  distance?: number
  time?: number
}

export interface AMapTransferResult {
  plans?: AMapTransferPlan[]
  info?: string
  message?: string
  infocode?: string
}

export interface AMapTransferInstance {
  clear: () => void
  search: (
    start: LngLatTuple,
    end: LngLatTuple,
    callback: (status: AMapServiceStatus, result: AMapTransferResult) => void
  ) => void
}

export interface AMapGeocodeItem {
  location?: AMapLngLatLike
}

export interface AMapGeocodeResult {
  geocodes?: AMapGeocodeItem[]
}

export interface AMapGeocoderInstance {
  getLocation: (
    address: string,
    callback: (status: AMapServiceStatus, result: AMapGeocodeResult) => void
  ) => void
}

export interface AMapPlaceSearchPoi {
  location?: AMapLngLatLike
}

export interface AMapPlaceSearchResult {
  poiList?: {
    pois?: AMapPlaceSearchPoi[]
  }
}

export interface AMapPlaceSearchInstance {
  search: (
    keyword: string,
    callback: (
      status: AMapServiceStatus,
      result: AMapPlaceSearchResult
    ) => void
  ) => void
}

export interface AMapGeolocationInstance {
  getCurrentPosition: (
    callback: (status: AMapServiceStatus, result: unknown) => void
  ) => void
}

export interface AMapNamespace {
  Map: new (
    container: HTMLElement,
    options: {
      zoom?: number
      center?: LngLatTuple
      resizeEnable?: boolean
      viewMode?: "2D" | "3D"
    }
  ) => AMapMapInstance
  Marker: new (options: {
    position: LngLatTuple
    title?: string
    offset?: unknown
    icon?: unknown
    zIndex?: number
    content?: string | HTMLElement
    label?: {
      content: string
      direction?: "top" | "right" | "bottom" | "left"
      offset?: unknown
    }
  }) => AMapMarkerInstance
  Polyline: new (options: {
    path: LngLatTuple[]
    strokeColor?: string
    strokeWeight?: number
    strokeOpacity?: number
    strokeStyle?: "solid" | "dashed"
    lineJoin?: "round" | "miter" | "bevel"
    showDir?: boolean
    zIndex?: number
  }) => AMapPolylineInstance
  Icon: new (options: { size: unknown; image: string }) => unknown
  Size: new (width: number, height: number) => unknown
  Pixel: new (x: number, y: number) => unknown
  Bounds: new () => AMapBoundsInstance
  ToolBar: new (options?: {
    locate?: boolean
    direction?: boolean
    ruler?: boolean
  }) => unknown
  Scale: new () => unknown
  Driving: new (options: {
    map?: AMapMapInstance
    hideMarkers?: boolean
    policy?: number
  }) => AMapDrivingInstance
  Walking: new (options: { map?: AMapMapInstance; hideMarkers?: boolean }) => AMapWalkingInstance
  Transfer?: new (options: {
    map?: AMapMapInstance
    city: string
    hideMarkers?: boolean
  }) => AMapTransferInstance
  Geocoder: new (options?: { city?: string }) => AMapGeocoderInstance
  PlaceSearch: new (options?: {
    city?: string
    citylimit?: boolean
    pageSize?: number
    pageIndex?: number
  }) => AMapPlaceSearchInstance
  Geolocation?: new (options?: Record<string, unknown>) => AMapGeolocationInstance
  DrivingPolicy: {
    LEAST_TIME: number
  }
  plugin: (plugins: string[], callback: () => void) => void
}

export interface AMapSecurityConfigWindow extends Window {
  _AMapSecurityConfig?: {
    securityJsCode: string
  }
}
