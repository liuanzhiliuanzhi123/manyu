import "server-only"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface QwenRequestInput {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

interface QwenMessageContentPart {
  type?: string
  text?: string
}

interface QwenChoice {
  message?: {
    content?: string | QwenMessageContentPart[]
  }
}

interface QwenChatResponse {
  choices?: QwenChoice[]
  error?: {
    message?: string
  }
}

const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
const DEFAULT_MODEL = "qwen-plus"

function getApiKey() {
  return (process.env.DASHSCOPE_API_KEY || "").trim()
}

function getBaseUrl() {
  return (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).trim()
}

function getModel() {
  return (process.env.DASHSCOPE_MODEL || DEFAULT_MODEL).trim()
}

function toTextContent(content: string | QwenMessageContentPart[] | undefined) {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || "")
      .join("")
      .trim()
  }
  return ""
}

export function hasDashscopeApiKey() {
  return Boolean(getApiKey())
}

export function getDashscopeRuntimeConfig() {
  return {
    baseUrl: getBaseUrl(),
    model: getModel(),
    hasApiKey: hasDashscopeApiKey(),
  }
}

export async function requestQwenJson(input: QwenRequestInput) {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is missing")
  }

  const baseUrl = getBaseUrl().replace(/\/+$/u, "")
  const model = input.model || getModel()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs ?? 15000)

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 1800,
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
      signal: controller.signal,
    })
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError"
    if (isAbort) {
      throw new Error("Qwen request timed out")
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  const payload = (await response.json()) as QwenChatResponse
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      `Qwen request failed with status ${response.status}`
    throw new Error(message)
  }

  const text = toTextContent(payload?.choices?.[0]?.message?.content).trim()
  if (!text) {
    throw new Error("Qwen returned empty content")
  }

  return {
    text,
    raw: payload,
  }
}
