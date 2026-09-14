import { z, type ConfigDeclaration } from "@effect-agent/effect-config"
import type { HerdrClientOptions } from "./herdr-client.ts"

const schema = z.object({
  socketPath: z.string().min(1).default("~/.config/herdr/herdr.sock"),
  timeoutMs: z.number().int().positive().max(600_000).default(10_000),
}).strict()

export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "herdr", title: "Herdr",
  description: "Workspaces, agents and panes of a running Herdr server, over its socket API",
  schema,
}

export const herdrSettings = (getConfig: () => unknown): HerdrClientOptions => {
  const config = schema.parse(getConfig())
  const home = Bun.env.HOME ?? ""
  return {
    socketPath: config.socketPath.startsWith("~/") ? `${home}${config.socketPath.slice(1)}` : config.socketPath,
    timeoutMs: config.timeoutMs,
  }
}
