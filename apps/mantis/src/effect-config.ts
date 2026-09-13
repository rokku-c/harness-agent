/**
 * mantis's *platform-facing* config — the embedded app's schema, registered with
 * the host. The standalone worker (`hosts/dingtalk`, `hosts/webui`, `hosts/mcp`)
 * reads `config.toml` instead, through `config/load.ts`; the two declare the same
 * six model knobs and their defaults differ on purpose, per surface.
 *
 * The defaults here are the embedded console's: a short session against a
 * workspace, not a long unattended DingTalk run. `config.example.toml` states the
 * worker's own (1024 steps, one reflection pass), which are clawyp's. Neither
 * set reaches the other surface — an operator tuning one does not move the other,
 * and `maxSteps` is where that is easiest to be wrong about.
 */
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
