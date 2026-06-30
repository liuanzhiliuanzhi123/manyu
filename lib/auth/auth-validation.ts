export interface ValidationResult {
  ok: boolean
  message?: string
}

export const RESET_PASSWORD_NEUTRAL_MESSAGE =
  "如果该邮箱已注册，我们会发送重置密码邮件，请检查邮箱。"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
const HAS_LETTER_PATTERN = /[A-Za-z]/u
const HAS_NUMBER_PATTERN = /\d/u

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function validateEmail(email: string): ValidationResult {
  const normalized = normalizeEmail(email)
  if (!normalized) {
    return { ok: false, message: "请输入邮箱。" }
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    return { ok: false, message: "请输入有效的邮箱地址。" }
  }
  return { ok: true }
}

export function validatePassword(password: string): ValidationResult {
  if (password.length < 8) {
    return { ok: false, message: "密码至少需要 8 位。" }
  }
  if (!HAS_LETTER_PATTERN.test(password) || !HAS_NUMBER_PATTERN.test(password)) {
    return { ok: false, message: "密码至少需要包含字母和数字。" }
  }
  return { ok: true }
}

export function validatePasswordConfirm(
  password: string,
  confirmPassword: string
): ValidationResult {
  if (password !== confirmPassword) {
    return { ok: false, message: "两次输入的密码不一致。" }
  }
  return { ok: true }
}

export function getResetPasswordNeutralMessage() {
  return RESET_PASSWORD_NEUTRAL_MESSAGE
}

export function isSafeRelativePath(value: string | null | undefined) {
  if (!value) return false
  if (!value.startsWith("/") || value.startsWith("//")) return false
  try {
    const parsed = new URL(value, "https://manyu.local")
    return parsed.origin === "https://manyu.local"
  } catch {
    return false
  }
}

export function getSafeRelativePath(
  value: string | null | undefined,
  fallback = "/"
) {
  if (!isSafeRelativePath(value)) return fallback
  return value || fallback
}
