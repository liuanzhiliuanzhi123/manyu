export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type BeijingPlaceType =
  | "scenic"
  | "food"
  | "hotel"
  | "shopping"
  | "cultural"
  | "other"

export type TripItemType =
  | "scenic"
  | "food"
  | "hotel"
  | "transit"
  | "rest"
  | "note"

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type ProfileInsert = {
  id: string
  email?: string | null
  display_name?: string | null
  avatar_url?: string | null
  created_at?: string
  updated_at?: string
}

export type ProfileUpdate = Partial<Omit<ProfileInsert, "id">>

export interface SavedPlace {
  id: string
  user_id: string
  place_id: string | null
  name: string
  city: string
  type: BeijingPlaceType
  address: string | null
  district: string | null
  lat: number | null
  lng: number | null
  image_url: string | null
  source: string | null
  tags: string[]
  rating: number | null
  price: number | null
  duration_minutes: number | null
  raw: Json
  created_at: string
  updated_at: string
}

export type SavedPlaceInsert = {
  id?: string
  user_id: string
  place_id?: string | null
  name: string
  city?: string
  type: BeijingPlaceType
  address?: string | null
  district?: string | null
  lat?: number | null
  lng?: number | null
  image_url?: string | null
  source?: string | null
  tags?: string[]
  rating?: number | null
  price?: number | null
  duration_minutes?: number | null
  raw?: Json
  created_at?: string
  updated_at?: string
}

export type SavedPlaceUpdate = Partial<Omit<SavedPlaceInsert, "id" | "user_id">>

export interface TripDraft {
  id: string
  user_id: string
  city: string
  title: string | null
  status: string | null
  days: number | null
  budget_min: number | null
  budget_max: number | null
  pace: string | null
  preferences: string[]
  selected_place_ids: string[]
  draft_data: Json
  created_at: string
  updated_at: string
}

export type TripDraftInsert = {
  id?: string
  user_id: string
  city?: string
  title?: string | null
  status?: string | null
  days?: number | null
  budget_min?: number | null
  budget_max?: number | null
  pace?: string | null
  preferences?: string[]
  selected_place_ids?: string[]
  draft_data?: Json
  created_at?: string
  updated_at?: string
}

export type TripDraftUpdate = Partial<Omit<TripDraftInsert, "id" | "user_id">>

export interface SavedTrip {
  id: string
  user_id: string
  city: string
  title: string
  start_date: string | null
  end_date: string | null
  days: number
  budget: number | null
  score: number | null
  status: string | null
  cover_image_url: string | null
  summary: string | null
  weather_summary: Json
  preferences: string[]
  plan_data: Json
  created_at: string
  updated_at: string
}

export type SavedTripInsert = {
  id?: string
  user_id: string
  city?: string
  title?: string
  start_date?: string | null
  end_date?: string | null
  days?: number
  budget?: number | null
  score?: number | null
  status?: string | null
  cover_image_url?: string | null
  summary?: string | null
  weather_summary?: Json
  preferences?: string[]
  plan_data?: Json
  created_at?: string
  updated_at?: string
}

export type SavedTripUpdate = Partial<Omit<SavedTripInsert, "id" | "user_id">>

export interface TripDay {
  id: string
  trip_id: string
  user_id: string
  day_index: number
  date: string | null
  title: string | null
  summary: string | null
  weather: Json
  created_at: string
  updated_at: string
}

export type TripDayInsert = {
  id?: string
  trip_id: string
  user_id: string
  day_index: number
  date?: string | null
  title?: string | null
  summary?: string | null
  weather?: Json
  created_at?: string
  updated_at?: string
}

export type TripDayUpdate = Partial<Omit<TripDayInsert, "id" | "trip_id" | "user_id">>

export interface TripItem {
  id: string
  trip_id: string
  day_id: string | null
  user_id: string
  item_index: number
  item_type: TripItemType
  place_id: string | null
  name: string
  city: string | null
  address: string | null
  district: string | null
  lat: number | null
  lng: number | null
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  transport_mode: string | null
  route_data: Json
  image_url: string | null
  notes: string | null
  raw: Json
  created_at: string
  updated_at: string
}

export type TripItemInsert = {
  id?: string
  trip_id: string
  day_id?: string | null
  user_id: string
  item_index: number
  item_type: TripItemType
  place_id?: string | null
  name: string
  city?: string | null
  address?: string | null
  district?: string | null
  lat?: number | null
  lng?: number | null
  start_time?: string | null
  end_time?: string | null
  duration_minutes?: number | null
  transport_mode?: string | null
  route_data?: Json
  image_url?: string | null
  notes?: string | null
  raw?: Json
  created_at?: string
  updated_at?: string
}

export type TripItemUpdate = Partial<Omit<TripItemInsert, "id" | "trip_id" | "user_id">>

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: []
      }
      saved_places: {
        Row: SavedPlace
        Insert: SavedPlaceInsert
        Update: SavedPlaceUpdate
        Relationships: []
      }
      trip_drafts: {
        Row: TripDraft
        Insert: TripDraftInsert
        Update: TripDraftUpdate
        Relationships: []
      }
      saved_trips: {
        Row: SavedTrip
        Insert: SavedTripInsert
        Update: SavedTripUpdate
        Relationships: []
      }
      trip_days: {
        Row: TripDay
        Insert: TripDayInsert
        Update: TripDayUpdate
        Relationships: []
      }
      trip_items: {
        Row: TripItem
        Insert: TripItemInsert
        Update: TripItemUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
