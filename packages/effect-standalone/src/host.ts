import type { EffectAppDescriptor } from "@effect-agent/effect-apps"
import type { ConfigOutcome } from "@effect-agent/effect-config"
import { buildNodeMcpServer } from "@effect-agent/effect-mcp"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { makeListenerManager, type ListenerManagerOptions } from "@effect-agent/effect-network"
import { registerStandaloneApp, type StandaloneRegistrationOptions } from "./registration.ts"

/** The one face a standalone host opens unless told otherwise. */
export const DEFAULT_MCP_PATH = "/mcp"

export interface StandaloneAppOptions extends StandaloneRegistrationOptions {
  readonly app: EffectAppDescriptor
  readonly hostname?: string
  /** 0 = an ephemeral port, which is what a caller that does not care should pass. */
  readonly port?: number
  readonly mcpPath?: string
  /** Also serve the app's own HTTP routes/UI. Off by default: hosted alone means the MCP face. */
  readonly appRoutes?: boolean
  /** Seam for tests: bind a fake listener instead of Bun's. */
  readonly listen?: ListenerManagerOptions["listen"]
}

export interface StandaloneApp {
  readonly app: string
  readonly requires: readonly string[]
  /** What is actually reachable, one entry per open face — read it, do not assume it. */
  readonly surface: readonly string[]
  /** The config the app runs with, with per-key provenance. */
  readonly config: ConfigOutcome
  readonly url: string
  readonly mcpUrl: string
  /** Idempotent: stops accepting, unregisters the app, closes the config store. */
  readonly stop: () => Promise<void>
}

/**
 * Host one app over streamable HTTP. The app's declared `routes`/`path` are
 * registered on the plugin host but are **not reachable** through this face
 * unless `appRoutes` is set: "MCP only" is a property of the composed face, and
 * the returned `surface` is the enumeration of what that face actually serves.
 */
export const startStandaloneApp = async (options: StandaloneAppOptions): Promise<StandaloneApp> => {
  const mcpPath = options.mcpPath ?? DEFAULT_MCP_PATH
  const registration = await registerStandaloneApp(options.app, {
    ...(options.config === undefined ? {} : { config: options.config }),
    ...(options.override === undefined ? {} : { override: options.override }),
  })
  const mcp = serveMcpHttp(() => Promise.resolve(buildNodeMcpServer(registration.registry)))
  const face = async (request: Request): Promise<Response> =>
    new URL(request.url).pathname === mcpPath
      ? mcp(request)
      : options.appRoutes === true ? registration.host.handle(request) : new Response("Not Found", { status: 404 })
  const manager = makeListenerManager({ handle: face, ...(options.listen === undefined ? {} : { listen: options.listen }) })
  const stop = async (): Promise<void> => { await manager.close(); await registration.stop() }
  try {
    await manager.register({ id: registration.app.id, hostname: options.hostname ?? "127.0.0.1", port: options.port ?? 0 })
  } catch (error) {
    await stop()
    throw error
  }
  const listener = manager.list()[0]
  return {
    app: registration.app.id,
    requires: registration.requires,
    surface: [`mcp:${mcpPath}`, ...(options.appRoutes === true ? ["app:routes"] : [])],
    config: registration.config,
    url: listener.url,
    mcpUrl: new URL(mcpPath, listener.url).href,
    stop,
  }
}
