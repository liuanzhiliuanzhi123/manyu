"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import {
  sendPasswordResetEmail,
  signInWithEmailPassword,
  signOutCurrentUser,
  signUpWithEmailPassword,
  updateCurrentPassword,
} from "@/lib/auth/auth-actions"
import { AuthContext } from "@/lib/auth/use-auth"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    if (!supabase.available) {
      setUser(null)
      setSession(null)
      setLoading(false)
      return null
    }

    const [{ data: sessionData }, { data: userData, error }] = await Promise.all([
      supabase.client.auth.getSession(),
      supabase.client.auth.getUser(),
    ])

    if (error || !userData.user) {
      setUser(null)
      setSession(null)
      setLoading(false)
      return null
    }

    setUser(userData.user)
    setSession(sessionData.session)
    setLoading(false)
    return userData.user
  }, [])

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    if (!supabase.available) {
      setLoading(false)
      return
    }

    let mounted = true
    void refreshUser()

    const {
      data: { subscription },
    } = supabase.client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [refreshUser])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInWithEmailPassword(email, password)
    if (result.ok) {
      await refreshUser()
    }
    return result
  }, [refreshUser])

  const signUp = useCallback(
    async (email: string, password: string, confirmPassword: string) => {
      const result = await signUpWithEmailPassword(email, password, confirmPassword)
      if (result.ok && !result.needsEmailConfirmation) {
        await refreshUser()
      }
      return result
    },
    [refreshUser]
  )

  const signOut = useCallback(async () => {
    const result = await signOutCurrentUser()
    setUser(null)
    setSession(null)
    return result
  }, [])

  const resetPassword = useCallback((email: string) => {
    return sendPasswordResetEmail(email)
  }, [])

  const updatePassword = useCallback(
    async (password: string, confirmPassword: string) => {
      const result = await updateCurrentPassword(password, confirmPassword)
      if (result.ok) {
        await refreshUser()
      }
      return result
    },
    [refreshUser]
  )

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isAuthenticated: Boolean(user),
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      refreshUser,
    }),
    [
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      refreshUser,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
