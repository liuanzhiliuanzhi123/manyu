"use client"

import type { Session, SupabaseClient, User } from "@supabase/supabase-js"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import type { Database } from "@/lib/supabase/types"
import { normalizeAuthError, type AuthAction } from "@/lib/auth/auth-errors"
import {
  getResetPasswordNeutralMessage,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "@/lib/auth/auth-validation"

export interface AuthActionResult {
  ok: boolean
  message: string
  code?: string
  user?: User | null
  session?: Session | null
  needsEmailConfirmation?: boolean
}

function unavailableResult(): AuthActionResult {
  return {
    ok: false,
    code: "auth_unavailable",
    message: "认证服务暂时不可用，请稍后再试。",
  }
}

function getAuthClient():
  | { available: true; client: SupabaseClient<Database> }
  | { available: false } {
  const supabase = createSupabaseBrowserClient()
  if (!supabase.available) return { available: false }
  return { available: true, client: supabase.client }
}

function getOrigin() {
  if (typeof window === "undefined") return ""
  return window.location.origin
}

function toFailure(error: unknown, action: AuthAction): AuthActionResult {
  const normalized = normalizeAuthError(error, action)
  return {
    ok: false,
    code: normalized.code,
    message: normalized.message,
  }
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<AuthActionResult> {
  const emailResult = validateEmail(email)
  if (!emailResult.ok) {
    return { ok: false, code: "invalid_email", message: emailResult.message || "" }
  }

  const passwordResult = validatePassword(password)
  if (!passwordResult.ok) {
    return { ok: false, code: "invalid_password", message: passwordResult.message || "" }
  }

  const supabase = getAuthClient()
  if (!supabase.available) return unavailableResult()

  const { data, error } = await supabase.client.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  })
  if (error) return toFailure(error, "signIn")

  return {
    ok: true,
    message: "登录成功。",
    user: data.user,
    session: data.session,
  }
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  confirmPassword: string
): Promise<AuthActionResult> {
  const emailResult = validateEmail(email)
  if (!emailResult.ok) {
    return { ok: false, code: "invalid_email", message: emailResult.message || "" }
  }

  const passwordResult = validatePassword(password)
  if (!passwordResult.ok) {
    return { ok: false, code: "invalid_password", message: passwordResult.message || "" }
  }

  const confirmResult = validatePasswordConfirm(password, confirmPassword)
  if (!confirmResult.ok) {
    return { ok: false, code: "password_mismatch", message: confirmResult.message || "" }
  }

  const supabase = getAuthClient()
  if (!supabase.available) return unavailableResult()

  const { data, error } = await supabase.client.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: {
      emailRedirectTo: `${getOrigin()}/auth/callback`,
    },
  })
  if (error) return toFailure(error, "signUp")

  const needsEmailConfirmation = !data.session
  return {
    ok: true,
    code: needsEmailConfirmation ? "email_confirmation_required" : "signed_in",
    message: needsEmailConfirmation
      ? "注册成功，请前往邮箱完成验证后再登录。"
      : "注册成功，已登录。",
    user: data.user,
    session: data.session,
    needsEmailConfirmation,
  }
}

export async function signOutCurrentUser(): Promise<AuthActionResult> {
  const supabase = getAuthClient()
  if (!supabase.available) return unavailableResult()

  const { error } = await supabase.client.auth.signOut()
  if (error) return toFailure(error, "signOut")
  return {
    ok: true,
    message: "已退出登录。",
    user: null,
    session: null,
  }
}

export async function sendPasswordResetEmail(
  email: string
): Promise<AuthActionResult> {
  const emailResult = validateEmail(email)
  if (!emailResult.ok) {
    return { ok: false, code: "invalid_email", message: emailResult.message || "" }
  }

  const supabase = getAuthClient()
  if (!supabase.available) return unavailableResult()

  const { error } = await supabase.client.auth.resetPasswordForEmail(
    normalizeEmail(email),
    {
      redirectTo: `${getOrigin()}/auth/callback?next=/auth/update-password`,
    }
  )
  if (error) return toFailure(error, "resetPassword")

  return {
    ok: true,
    code: "reset_email_sent",
    message: getResetPasswordNeutralMessage(),
  }
}

export async function updateCurrentPassword(
  password: string,
  confirmPassword: string
): Promise<AuthActionResult> {
  const passwordResult = validatePassword(password)
  if (!passwordResult.ok) {
    return { ok: false, code: "invalid_password", message: passwordResult.message || "" }
  }

  const confirmResult = validatePasswordConfirm(password, confirmPassword)
  if (!confirmResult.ok) {
    return { ok: false, code: "password_mismatch", message: confirmResult.message || "" }
  }

  const supabase = getAuthClient()
  if (!supabase.available) return unavailableResult()

  const { data, error } = await supabase.client.auth.updateUser({ password })
  if (error) return toFailure(error, "updatePassword")

  return {
    ok: true,
    code: "password_updated",
    message: "密码已更新，请使用新密码登录。",
    user: data.user,
  }
}
