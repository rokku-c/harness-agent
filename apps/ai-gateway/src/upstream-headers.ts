import { isCredentialHeader } from "@effect-agent/ai-gateway"
import type { GatewayProvider } from "./providers.ts"

const transportHeaders = new Set([
  "x-upstream-id", "host", "content-length", "connection", "keep-alive", "proxy-connection",
  "te", "trailer", "transfer-encoding", "upgrade", "anthropic-version",
  "openai-organization", "openai-project", "x-forwarded-client-cert",
])
const identity = /^x-(?:(?:effect|identity|agent|session|user|actor|tenant)(?:-|$)|forwarded-(?:user|email)$)/i

export const upstreamHeaders = (incoming: Headers, provider: GatewayProvider): Headers => {
  const headers = new Headers(incoming)
  const connection = new Set((incoming.get("connection") ?? "").split(",").map((s) => s.trim().toLowerCase()))
  const names: string[] = []
  ;(headers as Headers & { forEach(cb: (value: string, key: string) => void): void }).forEach((_value, name) => names.push(name))
  for (const name of names) {
    if (transportHeaders.has(name) || connection.has(name) || isCredentialHeader(name) || identity.test(name)) {
      headers.delete(name)
    }
  }
  if (provider.apiType === "anthropic.message") {
    if (provider.apiKey !== undefined) headers.set("x-api-key", provider.apiKey)
    headers.set("anthropic-version", "2023-06-01")
  } else if (provider.apiKey !== undefined) headers.set("authorization", `Bearer ${provider.apiKey}`)
  return headers
}
