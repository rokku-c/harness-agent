import type { EffectAppDescriptor } from "@effect-agent/effect-apps"
import type { ConfigOutcome } from "@effect-agent/effect-config"
import { buildNodeMcpServer } from "@effect-agent/effect-mcp"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { registerStandaloneApp, type StandaloneRegistrationOptions } from "./registration.ts"

export interface StandaloneStdioOptions extends StandaloneRegistrationOptions {
  readonly app: EffectAppDescriptor
  readonly transport?: Transport
}

export interface StandaloneStdio {
  readonly app: string
  readonly requires: readonly string[]
  readonly surface: readonly string[]
  readonly config: ConfigOutcome
  readonly stop: () => Promise<void>
}

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
