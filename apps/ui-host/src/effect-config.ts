import { z, type ConfigDeclaration } from "@effect-agent/effect-config"

const schema = z.object({
  host: z.string().default("127.0.0.1"),
  port: z.number().int().default(4870),
  databaseFile: z.string().default(".effect-agent/ui.sqlite"),
  theme: z.enum(["warm-paper", "dusk"]).default("warm-paper"),
})

export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "ui-host",
  title: "ui-host",
  description: "ui runtime host (/ui)",
  schema,
}
