"use client"

import { useEffect, useMemo, useState, type ImgHTMLAttributes } from "react"

export type PlacePhotoType = "scenic" | "food" | "hotel" | "attraction" | "restaurant"

interface PlacePhotoImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "onError"> {
  name?: string
  city?: string
  province?: string
  type?: PlacePhotoType
  alt: string
  fallbackSrc?: string
}

const PLACEHOLDER_BY_TYPE = {
  scenic: "/images/places/placeholders/scenic.jpg",
  food: "/images/places/placeholders/food.jpg",
  hotel: "/images/places/placeholders/hotel.jpg",
} as const

function normalizePhotoType(type?: PlacePhotoType): keyof typeof PLACEHOLDER_BY_TYPE {
  if (type === "food" || type === "restaurant") return "food"
  if (type === "hotel") return "hotel"
  return "scenic"
}

function normalizeCity(value?: string) {
  return (value || "").trim().replace(/市$/u, "")
}

function buildPlacePhotoUrl(name: string, city: string, type: keyof typeof PLACEHOLDER_BY_TYPE) {
  const params = new URLSearchParams({
    name,
    city,
    type,
  })
  return `/api/place-photo?${params.toString()}`
}

export function getPlacePhotoPlaceholder(type?: PlacePhotoType) {
  return PLACEHOLDER_BY_TYPE[normalizePhotoType(type)]
}

export function PlacePhotoImage({
  name,
  city,
  province,
  type,
  alt,
  fallbackSrc,
  loading = "lazy",
  decoding = "async",
  ...props
}: PlacePhotoImageProps) {
  const normalizedType = normalizePhotoType(type)
  const placeholder = fallbackSrc || PLACEHOLDER_BY_TYPE[normalizedType]
  const cityName = normalizeCity(city || province)
  const placeName = (name || alt || "").trim()
  const [src, setSrc] = useState(placeholder)
  const requestUrl = useMemo(() => {
    if (!placeName || !cityName) return ""
    return buildPlacePhotoUrl(placeName, cityName, normalizedType)
  }, [cityName, normalizedType, placeName])

  useEffect(() => {
    let cancelled = false
    setSrc(placeholder)

    if (!requestUrl) return

    async function loadPhoto() {
      try {
        const response = await fetch(requestUrl)
        const payload = (await response.json()) as {
          ok?: boolean
          imageUrl?: string
        }
        if (!cancelled && payload.ok && payload.imageUrl) {
          setSrc(payload.imageUrl)
        }
      } catch {
        if (!cancelled) setSrc(placeholder)
      }
    }

    void loadPhoto()

    return () => {
      cancelled = true
    }
  }, [placeholder, requestUrl])

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      loading={loading}
      decoding={decoding}
      onError={() => {
        setSrc((current) => (current === placeholder ? "/images/placeholders/poi-default.jpg" : placeholder))
      }}
    />
  )
}
