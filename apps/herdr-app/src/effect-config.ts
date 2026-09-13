import { z, type ConfigDeclaration } from "@effect-agent/effect-config"
import type { HerdrClientOptions } from "./herdr-client.ts"

/**
 * Where the Herdr server is, and how long a call may take.
 *
 * The socket path is config rather than a constant because Herdr's own
 * `HERDR_SOCKET` and its per-session sockets mean one machine can have several
 * servers running; the console states which one it is talking to instead of
 * assuming.
 */
const schema = z.object({
  /** The unix socket the running Herdr server owns. `~` is expanded at load. */
  socketPath: z.string().min(1).default("~/.config/herdr/herdr.sock"),
  /** How long one socket call may take before the console reports its own timeout. */
  timeoutMs: z.number().int().positive().max(600_000).default(10_000),
}).strict()

export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "herdr", title: "Herdr",
  description: "Workspaces, agents and panes of a running Herdr server, over its socket API",
  schema,
}

/**
 * The config as the plugin reads it, with the one piece of parsing a shell
 * would otherwise have done: Herdr keeps its socket under the home directory
 * and a config writes that as `~`. Nothing here runs a shell, so the
 * alternative is a client that dials a path literally named `~/.config/...`.
 */
export const herdrSettings = (getConfig: () => unknown): HerdrClientOptions => {
  const config = schema.parse(getConfig())
  const home = Bun.env.HOME ?? ""
  return {
    socketPath: config.socketPath.startsWith("~/") ? `${home}${config.socketPath.slice(1)}` : config.socketPath,
    timeoutMs: config.timeoutMs,
  }
}
