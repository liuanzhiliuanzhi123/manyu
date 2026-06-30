"use client"

import { createContext, useContext } from "react"
import type { Session, User } from "@supabase/supabase-js"
import type { AuthActionResult } from "@/lib/auth/auth-actions"

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<AuthActionResult>
  signUp: (
    email: string,
    password: string,
    confirmPassword: string
  ) => Promise<AuthActionResult>
  signOut: () => Promise<AuthActionResult>
  resetPassword: (email: string) => Promise<AuthActionResult>
  updatePassword: (
    password: string,
    confirmPassword: string
  ) => Promise<AuthActionResult>
  refreshUser: () => Promise<User | null>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
