import "server-only"

import type { PlannerTokenUsage } from "@/lib/observability/planner-observability-types"

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
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
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
  readonly durationMs?: number
  readonly timeoutMs?: number
  readonly providerModel?: string

  constructor(
    message: string,
    errorType: DeepSeekPlannerErrorType,
    details?: {
      statusCode?: number
      requestId?: string
      durationMs?: number
      timeoutMs?: number
      providerModel?: string
    }
  ) {
    super(message)
    this.name = "DeepSeekPlannerError"
    this.errorType = errorType
    this.statusCode = details?.statusCode
    this.requestId = details?.requestId
    this.durationMs = details?.durationMs
    this.timeoutMs = details?.timeoutMs
    this.providerModel = details?.providerModel
  }
}

const DEFAULT_BASE_URL = "https://api.deepseek.com"
const DEFAULT_MODEL = "deepseek-v4-pro"
const DEFAULT_TIMEOUT_MS = 60_000

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

function normalizeUsage(payload?: DeepSeekChatResponse["usage"]): PlannerTokenUsage | undefined {
  if (!payload) return undefined
  const promptTokens = payload.prompt_tokens ?? payload.promptTokens
  const completionTokens = payload.completion_tokens ?? payload.completionTokens
  const totalTokens = payload.total_tokens ?? payload.totalTokens
  if (
    !Number.isFinite(promptTokens) &&
    !Number.isFinite(completionTokens) &&
    !Number.isFinite(totalTokens)
  ) {
    return undefined
  }
  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : undefined,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : undefined,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : undefined,
  }
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
  const model = getDeepSeekModel()
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxTokens = input.maxTokens ?? 2400
  if (!apiKey) {
    throw new DeepSeekPlannerError("DeepSeek API key is missing", "missing_key", {
      providerModel: model,
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  try {
    const response = await fetch(`${getDeepSeekBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        response_format: { type: "json_object" },
        temperature: input.temperature ?? 0.4,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    })
    const durationMs = Date.now() - startedAt

    if (!response.ok) {
      throw new DeepSeekPlannerError("DeepSeek request failed", "http_status", {
        statusCode: response.status,
        requestId:
          response.headers.get("x-request-id") ||
          response.headers.get("x-ds-request-id") ||
          undefined,
        durationMs,
        timeoutMs,
        providerModel: model,
      })
    }

    const payload = (await response.json()) as DeepSeekChatResponse
    const text = toTextContent(payload.choices?.[0]?.message?.content).trim()

    if (!text) {
      throw new DeepSeekPlannerError("DeepSeek returned empty content", "empty_response", {
        requestId: payload.id,
        durationMs,
        timeoutMs,
        providerModel: model,
      })
    }

    return {
      id: payload.id,
      text,
      usage: normalizeUsage(payload.usage),
      providerStatus: response.status,
      providerModel: model,
      durationMs,
      timeoutMs,
      maxTokens,
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new DeepSeekPlannerError("DeepSeek request timed out", "timeout", {
        durationMs: Date.now() - startedAt,
        timeoutMs,
        providerModel: model,
      })
    }
    if (error instanceof DeepSeekPlannerError) throw error
    throw new DeepSeekPlannerError("DeepSeek network error", "network", {
      durationMs: Date.now() - startedAt,
      timeoutMs,
      providerModel: model,
    })
  } finally {
    clearTimeout(timeout)
  }
}
