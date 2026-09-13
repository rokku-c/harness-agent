import { z } from "@effect-agent/effect-config"
import type { ConfigDeclaration } from "@effect-agent/effect-config"

const model = z.object({
  api: z.enum(["openai.chat", "anthropic.messages"]).default("openai.chat"),
  model: z.string().min(1).default("gpt-4o-mini"),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  maxSteps: z.number().int().positive().default(12),
  maxReflections: z.number().int().nonnegative().default(2),
}).strict()

const schema = z.object({
  workspaceDir: z.string().default(".effect-agent/mantis"),
  protectedTools: z.array(z.string().min(1)).default([]),
  approveTimeoutMs: z.number().int().positive().optional(),
  model: model.default({ api: "openai.chat", model: "gpt-4o-mini", maxSteps: 12, maxReflections: 2 }),
}).strict()

/** mantis platform-facing config for the embedded app. */
export const effectConfig = {
  appId: "mantis",
  title: "Mantis",
  description: "Human-agent conversations, workspace records, memory, and approvals",
  schema,
} satisfies ConfigDeclaration<typeof schema>
