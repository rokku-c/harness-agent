import type { SqliteConfigStoreOptions } from "@effect-agent/effect-config"
import { makeAiGatewayHandler, type AiGatewayHandlerOptions } from "./handler.ts"
import { gatewayConfig, type AiGatewayConfig } from "./config.ts"
import { typeOrmRecorder } from "./recorder.ts"
import { openGatewayConfig } from "./standalone-config.ts"

/** Self-managed listener options; never read from the application config. */
export interface StandaloneListenerOptions { readonly port?: number }
export type AiGatewayServerOptions = Omit<AiGatewayConfig, "rules"> & AiGatewayHandlerOptions & StandaloneListenerOptions

export const startAiGateway = (options: AiGatewayServerOptions = {}) => {
  const { getConfig: readConfig, send, recorder, rules, port, ...settings } = options
  const getConfig = readConfig ?? (() => settings)
  const config = gatewayConfig(getConfig())
  const storedRecorder = options.recorder === undefined ? typeOrmRecorder(config.database) : undefined
  const server = Bun.serve({
    port: port ?? 4890,
    fetch: makeAiGatewayHandler({ send, rules, getConfig, recorder: recorder ?? storedRecorder }),
  })
  const stop = server.stop.bind(server)
  server.stop = async (closeActiveConnections?: boolean) => {
    await stop(closeActiveConnections)
    await storedRecorder?.close()
  }
  return server
}

export type StandaloneAiGatewayOptions = SqliteConfigStoreOptions & Omit<AiGatewayHandlerOptions, "getConfig"> & StandaloneListenerOptions

export const startStandaloneAiGateway = (options: StandaloneAiGatewayOptions = {}) => {
  const config = openGatewayConfig(options)
  try {
    const server = startAiGateway({ ...options, getConfig: config.getConfig })
    const stop = server.stop.bind(server)
    server.stop = async (closeActiveConnections?: boolean) => {
      try { await stop(closeActiveConnections) }
      finally { config.close() }
    }
    return server
  } catch (cause) { config.close(); throw cause }
}
