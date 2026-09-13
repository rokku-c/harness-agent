import type { EffectAppDescriptor } from "@effect-agent/effect-apps"
import type { ConfigOutcome } from "@effect-agent/effect-config"
import { buildNodeMcpServer } from "@effect-agent/effect-mcp"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { registerStandaloneApp, type StandaloneRegistrationOptions } from "./registration.ts"

export interface StandaloneStdioOptions extends StandaloneRegistrationOptions {
  readonly app: EffectAppDescriptor
  /** Seam for tests: connect this transport instead of the process's own stdio. */
  readonly transport?: Transport
}

export interface StandaloneStdio {
  readonly app: string
  readonly requires: readonly string[]
  readonly surface: readonly string[]
  /** The config the app runs with, with per-key provenance. */
  readonly config: ConfigOutcome
  /** Idempotent: closes the MCP server, unregisters the app, closes the config store. */
  readonly stop: () => Promise<void>
}

/** The same single-app host, on stdio — for callers that spawn it rather than dial a port. */
export const startStandaloneStdio = async (options: StandaloneStdioOptions): Promise<StandaloneStdio> => {
  const registration = await registerStandaloneApp(options.app, {
    ...(options.config === undefined ? {} : { config: options.config }),
    ...(options.override === undefined ? {} : { override: options.override }),
  })
  const server = buildNodeMcpServer(registration.registry)
  const stop = async (): Promise<void> => {
    await server.close().catch(() => undefined)
    await registration.stop()
  }
  try {
    await server.connect(options.transport ?? new StdioServerTransport())
  } catch (error) {
    await stop()
    throw error
  }
  return {
    app: registration.app.id,
    requires: registration.requires,
    surface: ["mcp:stdio"],
    config: registration.config,
    stop,
  }
}
