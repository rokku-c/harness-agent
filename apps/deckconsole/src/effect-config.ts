import { z, type ConfigDeclaration } from "@effect-agent/effect-config"

const schema = z.object({
  host: z.string().default("127.0.0.1"),
  port: z.number().int().default(4851),
  configFile: z.string().default(".effect-agent/deckconsole.sqlite"),
})

export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "deckconsole",
  title: "deckconsole",
  description: "deckconsole control room (/deck)",
  schema,
}
