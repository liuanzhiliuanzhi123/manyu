"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, ShieldCheck } from "lucide-react"
import { AppButton } from "@/components/ui/app-button"
import { AppCard } from "@/components/ui/app-card"
import { AppInput } from "@/components/ui/app-input"
import { Label } from "@/components/ui/label"
import { getResetPasswordNeutralMessage } from "@/lib/auth/auth-validation"
import { useAuth } from "@/lib/auth/use-auth"

export function ResetPasswordPageClient() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [success, setSuccess] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (submitting) return
    setMessage("")
    setSuccess("")
    setSubmitting(true)
    const result = await resetPassword(email)
    setSubmitting(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setSuccess(getResetPasswordNeutralMessage())
  }

  return (
    <main className="min-h-screen bg-[var(--app-canvas)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="mb-5">
          <Link href="/auth" className="text-sm font-medium text-[var(--app-brand)]">
            返回登录
          </Link>
        </div>
        <AppCard tone="elevated" padding="lg" className="space-y-5">
          <div className="space-y-2">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="app-page-title">重置密码</h1>
            <p className="text-sm leading-6 text-[var(--app-text-secondary)]">
              输入注册邮箱，我们会发送重置密码邮件。
            </p>
          </div>

          {message && (
            <p className="rounded-[var(--app-radius-sm)] border border-[color:rgba(184,90,77,0.22)] bg-[color:rgba(184,90,77,0.08)] px-3 py-2 text-sm text-[var(--app-error)]">
              {message}
            </p>
          )}
          {success && (
            <p className="rounded-[var(--app-radius-sm)] border border-[color:rgba(109,135,80,0.24)] bg-[color:rgba(109,135,80,0.1)] px-3 py-2 text-sm text-[var(--app-success)]">
              {success}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="reset-email">邮箱</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
              <AppInput
                id="reset-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="pl-9"
              />
            </div>
          </div>

          <AppButton
            type="button"
            size="lg"
            className="w-full"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "发送中..." : "发送重置邮件"}
          </AppButton>

          <p className="text-xs leading-5 text-[var(--app-text-secondary)]">
            为保护账号安全，页面不会提示该邮箱是否存在。
          </p>
        </AppCard>
      </div>
    </main>
  )
}
