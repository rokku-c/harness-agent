import { z } from "@effect-agent/effect-config"

export const apiTypes = ["openai.chat", "openai.responses", "anthropic.message"] as const
export type ApiType = typeof apiTypes[number]

const baseURL = z.string().min(1).url().refine((value) => {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
}, "baseURL must be an HTTP(S) URL without embedded credentials")

export const providerSchema = z.object({
  id: z.string().min(1).refine((value) => value.trim() === value, "id must not have surrounding whitespace"),
  apiType: z.enum(apiTypes),
  baseURL,
  apiKey: z.string().optional(),
  enabled: z.boolean().optional(),
}).strict()
export type GatewayProvider = z.infer<typeof providerSchema>

export const providersSchema = z.array(providerSchema).superRefine((providers, ctx) => {
  const seen = new Set<string>()
  providers.forEach((provider, index) => {
    if (seen.has(provider.id)) ctx.addIssue({
      code: "custom", path: [index, "id"], message: `duplicate provider id: ${provider.id}`,
    })
    seen.add(provider.id)
  })
})

const routes = new Map<string, ApiType>([
  ["/v1/chat/completions", "openai.chat"],
  ["/v1/responses", "openai.responses"],
  ["/v1/messages", "anthropic.message"],
])
export const apiTypeForPath = (path: string): ApiType | undefined => routes.get(path)
