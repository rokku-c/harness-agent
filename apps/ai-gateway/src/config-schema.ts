import { z } from "@effect-agent/effect-config"
import { providersSchema } from "./providers.ts"

const ruleSchema = z.object({
  ruleId: z.string(),
  match: z.object({
    agent: z.string().optional(), session: z.string().optional(),
    model: z.string().optional(), path: z.string().optional(),
  }).strict().optional(),
  inject: z.object({
    content: z.string(),
    position: z.enum(["system-prefix", "system-suffix"]).optional(),
  }).strict(),
}).strict()

export const gatewaySchema = z.object({
  providers: providersSchema.optional(),
  database: z.string().min(1).optional(),
  captureBodies: z.boolean().optional(),
  rules: z.array(ruleSchema).optional(),
}).strict()
export type AiGatewayConfig = z.infer<typeof gatewaySchema>
