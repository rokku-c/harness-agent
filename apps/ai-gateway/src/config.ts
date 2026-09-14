import { gatewaySchema } from "./config-schema.ts"
export type { AiGatewayConfig } from "./config-schema.ts"
export type { ApiType, GatewayProvider } from "./providers.ts"

export const gatewayConfig = (value: unknown = {}) => {
  const config = gatewaySchema.parse(value)
  return {
    ...config,
    database: config.database ?? ".effect-agent/ai-gateway.sqlite",
    captureBodies: config.captureBodies ?? false,
    rules: config.rules ?? [],
  }
}
