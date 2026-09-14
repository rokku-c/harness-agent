import type { EffectAppDescriptor } from "@effect-agent/effect-apps"
import type { ConfigOutcome } from "@effect-agent/effect-config"
import { buildNodeMcpServer } from "@effect-agent/effect-mcp"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { makeListenerManager, type ListenerManagerOptions } from "@effect-agent/effect-network"
import { registerStandaloneApp, type StandaloneRegistrationOptions } from "./registration.ts"

export const DEFAULT_MCP_PATH = "/mcp"

export interface StandaloneAppOptions extends StandaloneRegistrationOptions {
  readonly app: EffectAppDescriptor
  readonly hostname?: string
  readonly port?: number
  readonly mcpPath?: string
  readonly appRoutes?: boolean
  readonly listen?: ListenerManagerOptions["listen"]
}

export interface StandaloneApp {
  readonly app: string
  readonly requires: readonly string[]
  readonly surface: readonly string[]
  readonly config: ConfigOutcome
  readonly url: string
  readonly mcpUrl: string
  readonly stop: () => Promise<void>
}

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
