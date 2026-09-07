import type { GatewayRule } from "@effect-agent/ai-gateway"

const rules = (raw: string | undefined): ReadonlyArray<GatewayRule> => {
  if (raw === undefined || raw.trim() === "") return []
  const value = JSON.parse(raw) as unknown
  if (!Array.isArray(value)) throw new Error("AI_GATEWAY_RULES must be a JSON array")
  return value as GatewayRule[]
}

export const gatewayConfig = (env: Record<string, string | undefined> = process.env) => ({
  port: Number(env.AI_GATEWAY_PORT ?? 4890),
  upstreamBase: env.AI_GATEWAY_UPSTREAM ?? "https://api.openai.com",
  apiKey: env.AI_GATEWAY_API_KEY,
  database: env.AI_GATEWAY_DATABASE ?? ".effect-agent/ai-gateway.sqlite",
  captureBodies: env.AI_GATEWAY_CAPTURE_BODIES === "true",
  rules: rules(env.AI_GATEWAY_RULES)
})
