import "server-only"

interface DeepSeekRequestInput {
  messages: Array<{
    role: "system" | "user" | "assistant"
    content: string
  }>
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

interface DeepSeekMessageContentPart {
  text?: string
}

interface DeepSeekChoice {
  message?: {
    content?: string | DeepSeekMessageContentPart[]
  }
}

interface DeepSeekChatResponse {
  id?: string
  choices?: DeepSeekChoice[]
}

export type DeepSeekPlannerErrorType =
  | "missing_key"
  | "timeout"
  | "http_status"
  | "empty_response"
  | "network"

export class DeepSeekPlannerError extends Error {
  readonly errorType: DeepSeekPlannerErrorType
  readonly statusCode?: number
  readonly requestId?: string

  constructor(
    message: string,
    errorType: DeepSeekPlannerErrorType,
    details?: { statusCode?: number; requestId?: string }
  ) {
    super(message)
    this.name = "DeepSeekPlannerError"
    this.errorType = errorType
    this.statusCode = details?.statusCode
    this.requestId = details?.requestId
  }
}

const DEFAULT_BASE_URL = "https://api.deepseek.com"
const DEFAULT_MODEL = "deepseek-v4-pro"
const DEFAULT_TIMEOUT_MS = 30_000

function getDeepSeekApiKey() {
  return (process.env.DEEPSEEK_API_KEY || "").trim()
}

function getDeepSeekBaseUrl() {
  return (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/u, "")
}

function getDeepSeekModel() {
  return (process.env.DEEPSEEK_MODEL || DEFAULT_MODEL).trim()
}

function toTextContent(content: string | DeepSeekMessageContentPart[] | undefined) {
  if (!content) return ""
  if (typeof content === "string") return content
  return content.map((part) => part.text || "").join("")
}

export function hasDeepSeekApiKey() {
  return Boolean(getDeepSeekApiKey())
}

export function getDeepSeekRuntimeConfig() {
  return {
    baseUrl: getDeepSeekBaseUrl(),
    model: getDeepSeekModel(),
    hasApiKey: hasDeepSeekApiKey(),
  }
}

export async function requestDeepSeekJson(input: DeepSeekRequestInput) {
  const apiKey = getDeepSeekApiKey()
  if (!apiKey) {
    throw new DeepSeekPlannerError("DeepSeek API key is missing", "missing_key")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${getDeepSeekBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getDeepSeekModel(),
        messages: input.messages,
        response_format: { type: "json_object" },
        temperature: input.temperature ?? 0.4,
        max_tokens: input.maxTokens ?? 2400,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new DeepSeekPlannerError("DeepSeek request failed", "http_status", {
        statusCode: response.status,
        requestId:
          response.headers.get("x-request-id") ||
          response.headers.get("x-ds-request-id") ||
          undefined,
      })
    }

    const payload = (await response.json()) as DeepSeekChatResponse
    const text = toTextContent(payload.choices?.[0]?.message?.content).trim()

    if (!text) {
      throw new DeepSeekPlannerError("DeepSeek returned empty content", "empty_response", {
        requestId: payload.id,
      })
    }

    return {
      id: payload.id,
      text,
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new DeepSeekPlannerError("DeepSeek request timed out", "timeout")
    }
    if (error instanceof DeepSeekPlannerError) throw error
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
