"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Lock, Mail, ShieldCheck, UserPlus } from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import { AppInput } from "@/components/ui/app-input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth/use-auth"
import { getSafeRelativePath } from "@/lib/auth/auth-validation"
import { cn } from "@/lib/utils"

type AuthMode = "signin" | "signup"

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  auth_unavailable: "认证服务暂时不可用，请稍后再试。",
  callback_failed: "验证链接已失效，请重新登录或重试。",
  callback_missing_code: "验证链接已失效，请重新登录或重试。",
  invalid_credentials: "登录失败，请检查邮箱或密码。",
}

function FieldMessage({ message }: { message: string }) {
  if (!message) return null
  return (
    <p className="rounded-[var(--app-radius-sm)] border border-[color:rgba(184,90,77,0.22)] bg-[color:rgba(184,90,77,0.08)] px-3 py-2 text-sm text-[var(--app-error)]">
      {message}
    </p>
  )
}

function SuccessMessage({ message }: { message: string }) {
  if (!message) return null
  return (
    <p className="rounded-[var(--app-radius-sm)] border border-[color:rgba(109,135,80,0.24)] bg-[color:rgba(109,135,80,0.1)] px-3 py-2 text-sm text-[var(--app-success)]">
      {message}
    </p>
  )
}

export function AuthPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, signUp, isAuthenticated, loading: authLoading } = useAuth()
  const initialMode: AuthMode = searchParams.get("mode") === "signup" ? "signup" : "signin"
  const nextPath = useMemo(
    () => getSafeRelativePath(searchParams.get("next"), "/"),
    [searchParams]
  )
  const callbackMessage = useMemo(() => {
    const error = searchParams.get("error")
    if (!error) return ""
    return CALLBACK_ERROR_MESSAGES[error] || "认证链接已失效，请重新登录或重试。"
  }, [searchParams])

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState(callbackMessage)
  const [success, setSuccess] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setMessage(callbackMessage)
  }, [callbackMessage])

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(nextPath)
    }
  }, [authLoading, isAuthenticated, nextPath, router])

  const resetStatus = () => {
    setMessage("")
    setSuccess("")
  }

  const handleSignIn = async () => {
    if (submitting) return
    resetStatus()
    setSubmitting(true)
    const result = await signIn(email, password)
    setSubmitting(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setSuccess(result.message)
    router.replace(nextPath)
  }

  const handleSignUp = async () => {
    if (submitting) return
    resetStatus()
    setSubmitting(true)
    const result = await signUp(email, password, confirmPassword)
    setSubmitting(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setSuccess(result.message)
    if (!result.needsEmailConfirmation) {
      router.replace(nextPath)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--app-canvas)] px-4 py-8 text-[var(--app-text-primary)]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="mb-5">
          <Link
            href="/"
            className="text-sm font-medium text-[var(--app-brand)] hover:text-[var(--app-brand-hover)]"
          >
            返回拾景拼途
          </Link>
        </div>

        <AppCard tone="elevated" padding="lg" className="space-y-5">
          <div className="space-y-2">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="app-page-title">拾景拼途账号</h1>
              <p className="mt-1 text-sm leading-6 text-[var(--app-text-secondary)]">
                登录后同步你的北京行程、收藏和旅行方案。
              </p>
            </div>
          </div>

          <Tabs value={mode} onValueChange={(value) => {
            setMode(value as AuthMode)
            resetStatus()
          }}>
            <TabsList className="grid h-11 w-full grid-cols-2 rounded-[var(--app-radius-sm)] bg-[var(--app-surface-muted)] p-1">
              <TabsTrigger
                value="signin"
                className={cn(
                  "rounded-[calc(var(--app-radius-sm)-4px)] text-sm",
                  "data-[state=active]:bg-[var(--app-surface-elevated)] data-[state=active]:text-[var(--app-text-strong)]"
                )}
              >
                登录
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className={cn(
                  "rounded-[calc(var(--app-radius-sm)-4px)] text-sm",
                  "data-[state=active]:bg-[var(--app-surface-elevated)] data-[state=active]:text-[var(--app-text-strong)]"
                )}
              >
                注册
              </TabsTrigger>
            </TabsList>

            <FieldMessage message={message} />
            <SuccessMessage message={success} />

            <TabsContent value="signin" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">邮箱</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
                  <AppInput
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signin-password">密码</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
                  <AppInput
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="至少 8 位，包含字母和数字"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Link
                  href="/auth/reset-password"
                  className="text-sm font-medium text-[var(--app-brand)] hover:text-[var(--app-brand-hover)]"
                >
                  忘记密码？
                </Link>
              </div>

              <AppButton
                type="button"
                size="lg"
                className="w-full"
                disabled={submitting || authLoading}
                onClick={() => void handleSignIn()}
              >
                {submitting && mode === "signin" ? "登录中..." : "登录"}
              </AppButton>
            </TabsContent>

            <TabsContent value="signup" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">邮箱</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
                  <AppInput
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">密码</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
                  <AppInput
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="至少 8 位，包含字母和数字"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">确认密码</Label>
                <div className="relative">
                  <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
                  <AppInput
                    id="signup-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="再次输入密码"
                    className="pl-9"
                  />
                </div>
              </div>

              <AppButton
                type="button"
                size="lg"
                className="w-full"
                disabled={submitting || authLoading}
                onClick={() => void handleSignUp()}
              >
                {submitting && mode === "signup" ? "创建中..." : "创建账号"}
              </AppButton>
            </TabsContent>
          </Tabs>

          <p className="rounded-[var(--app-radius-sm)] bg-[var(--app-surface)] px-3 py-3 text-xs leading-5 text-[var(--app-text-secondary)]">
            我们不会在本地保存你的密码，行程数据仅用于同步你的旅行方案。
          </p>
        </AppCard>
      </div>
    </main>
  )
}
