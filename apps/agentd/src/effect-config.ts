import { z, type ConfigDeclaration } from "@effect-agent/effect-config"
export const effectConfig: ConfigDeclaration = { appId: "agentd", title: "agentd", schema: z.object({}).strict() }
