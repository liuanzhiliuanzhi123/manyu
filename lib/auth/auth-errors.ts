export type AuthAction =
  | "signIn"
  | "signUp"
  | "signOut"
  | "resetPassword"
  | "updatePassword"
  | "callback"
  | "default"

export interface NormalizedAuthError {
  code: string
  message: string
}

function readErrorField(error: unknown, field: "message" | "code" | "name") {
  if (!error || typeof error !== "object") return ""
  const value = (error as Record<string, unknown>)[field]
  return typeof value === "string" ? value : ""
}

function readStatus(error: unknown) {
  if (!error || typeof error !== "object") return undefined
  const value = (error as Record<string, unknown>).status
  return typeof value === "number" ? value : undefined
}

export function normalizeAuthError(
  error: unknown,
  action: AuthAction = "default"
): NormalizedAuthError {
  const message = readErrorField(error, "message").toLowerCase()
  const code = readErrorField(error, "code").toLowerCase()
  const name = readErrorField(error, "name").toLowerCase()
  const status = readStatus(error)
  const source = [message, code, name].join(" ")

  if (
    status === 429 ||
    source.includes("rate") ||
    source.includes("too many") ||
    source.includes("security purposes")
  ) {
    return {
      code: "rate_limited",
      message: "请求过于频繁，请稍后再试。",
    }
  }

  if (source.includes("weak password") || source.includes("password")) {
    return {
      code: "weak_password",
      message: "密码至少需要 8 位，并包含字母和数字。",
    }
  }

  if (action === "signIn") {
    return {
      code: "invalid_credentials",
      message: "登录失败，请检查邮箱或密码。",
    }
  }

  if (action === "signUp") {
    return {
      code: "signup_failed",
      message: "注册失败，请确认邮箱和密码后重试。",
    }
  }

  if (action === "resetPassword") {
    return {
      code: "reset_failed",
      message: "暂时无法发送重置邮件，请稍后再试。",
    }
  }

  if (action === "updatePassword") {
    return {
      code: "update_failed",
      message: "密码更新失败，请重新通过邮件链接进入后再试。",
    }
  }

  if (action === "callback") {
    return {
      code: "callback_failed",
      message: "验证链接已失效，请重新登录或重试。",
    }
  }

  return {
    code: "auth_failed",
    message: "认证服务暂时不可用，请稍后再试。",
  }
}
