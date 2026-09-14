import { registerEffectApp, type AsyncAppDisposer, type EffectAppDescriptor } from "@effect-agent/effect-apps"
import { makeConfigRegistry, makeSqliteConfigStore, type ConfigOutcome } from "@effect-agent/effect-config"
import { makePluginHost, type EffectPluginHost } from "@effect-agent/effect-host"
import { makeEffectRegistry, type EffectRegistry } from "@effect-agent/effect-interface"
import { makeRegistry } from "@effect-agent/mcp-registry"
import { makeMcpSetSlot } from "@effect-agent/mcp-gateway"
import { dependencyError, dependencyGaps } from "./dependencies.ts"

export interface StandaloneRegistrationOptions {
  readonly config?: unknown
  readonly override?: unknown
}

export interface StandaloneRegistration {
  readonly app: EffectAppDescriptor
  readonly requires: readonly string[]
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
  readonly config: ConfigOutcome
  readonly stop: () => Promise<void>
}

export const registerStandaloneApp = async (
  app: EffectAppDescriptor, options: StandaloneRegistrationOptions = {},
): Promise<StandaloneRegistration> => {
  const missing = dependencyGaps(app, [app.id])
  if (missing.length > 0) throw dependencyError(app, missing)

  const host = makePluginHost()
  const registry = makeEffectRegistry()
  const configs = makeConfigRegistry({ store: makeSqliteConfigStore({ file: ":memory:" }) })
  let resolved: ConfigOutcome = { ok: true, appId: app.id, value: {}, sources: {} }
  let dispose: AsyncAppDisposer | undefined
  const stop = async (): Promise<void> => {
    try { await dispose?.() } finally { configs.close() }
  }
  try {
    dispose = await registerEffectApp({
      host, registry, configs, mcpRegistry: makeRegistry(), mcpSets: makeMcpSetSlot(),
      initializeConfig: (id) => {
        const out = configs.initialize(id, {
          ...(options.config === undefined ? {} : { yaml: options.config }),
          ...(options.override === undefined ? {} : { override: options.override }),
        })
        if (!out.ok) throw new Error(`Invalid config for ${id}: ${out.error}`)
        resolved = out
      },
      activeConfig: (id) => configs.read(id).value,
    }, app)
  } catch (error) {
    await stop()
    throw error
  }
  return { app, requires: app.requires ?? [], host, registry, config: resolved, stop }
}
