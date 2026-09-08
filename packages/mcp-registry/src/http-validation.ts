import { z } from "zod"

const id = z.string().min(1)
const endpoint = z.string().url().refine((raw) => {
  const url = new URL(raw)
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
}, "expected HTTP(S) endpoint without embedded credentials")
export const announceSchema = z.object({
  serverId: id, name: id, version: id, namespace: id.optional(), era: z.enum(["modern", "auto", "legacy"]),
  transport: z.object({ kind: z.literal("streamable-http"), endpoint }).strict(),
  capabilities: z.object({ tools: z.number().int().nonnegative().optional(), resources: z.number().int().nonnegative().optional(),
    prompts: z.number().int().nonnegative().optional(), apps: z.number().int().nonnegative().optional() }).strict().optional(),
  apps: z.array(id).optional(),
}).strict()
export const heartbeatSchema = z.object({ serverId: id }).strict()
