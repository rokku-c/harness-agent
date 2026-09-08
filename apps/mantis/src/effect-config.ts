import { z } from "@effect-agent/effect-config"
import type { ConfigDeclaration } from "@effect-agent/effect-config"

/** mantis platform-facing config (its runtime stays its own worker). */
export const effectConfig: ConfigDeclaration = {
  appId: "mantis",
  title: "Mantis",
  description: "DingTalk agent (declarative facade; worker runs independently)",
  schema: z.object({
    webPort: z.number().int().default(3737),
    host: z.string().default("127.0.0.1"),
    configFile: z.string().default(".effect-agent/mantis/config.toml"),
    workspaceDir: z.string().default(".effect-agent/mantis"),
    approvals: z.enum(["allow", "ask", "deny"]).default("ask"),
  }),
}
