import type { ConfigDeclaration } from "@effect-agent/effect-config"
import { gatewaySchema } from "./config-schema.ts"

export const effectConfig = {
  appId: "ai-gateway",
  title: "ai-gateway",
  description: "model proxy (openai.chat / openai.responses / anthropic.message)",
  schema: gatewaySchema,
} satisfies ConfigDeclaration<typeof gatewaySchema>
