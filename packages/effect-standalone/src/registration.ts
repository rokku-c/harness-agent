import { registerEffectApp, type AsyncAppDisposer, type EffectAppDescriptor } from "@effect-agent/effect-apps"
import { makeConfigRegistry, makeSqliteConfigStore, type ConfigOutcome } from "@effect-agent/effect-config"
import { makePluginHost, type EffectPluginHost } from "@effect-agent/effect-host"
import { makeEffectRegistry, type EffectRegistry } from "@effect-agent/effect-interface"
import { makeRegistry } from "@effect-agent/mcp-registry"
import { dependencyError, dependencyGaps } from "./dependencies.ts"

export interface StandaloneRegistrationOptions {
  /** The effect.yaml `config:` layer for the app; schema defaults fill the rest. */
  readonly config?: unknown
  /**
   * The config registry's own `override` layer, the same one `contract.ts`
   * names in `default < yaml < override`. It merges **over** the yaml layer key
   * by key rather than replacing it, so a caller can move one value (the file an
   * app writes, say) without restating a config it does not own.
   */
  readonly override?: unknown
}

export interface StandaloneRegistration {
  readonly app: EffectAppDescriptor
  readonly requires: readonly string[]
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
  /**
   * What the app actually runs with, and which layer every key came from. Read
   * it rather than assume: a host that cannot say what an app was configured
   * with cannot say what that app is about to touch.
   */
  readonly config: ConfigOutcome
  /** Idempotent: unregisters the app and closes its config store. */
  readonly stop: () => Promise<void>
}

/**
 * Register exactly one app against a bare plugin host and an empty interface
 * registry, so nothing but this app's own tools is reachable. The composition
 * root's kernel, listeners, config runtime and control planes are absent **by
 * construction** — they are things `apps/effect-server` adds, never defaults here.
 *
 * The shared MCP registry is injected unconditionally, exactly as the composition
 * root does. It is a **host context object, not an app**: an app that requires
 * the `mcp-registry` app still gets refused below, because the object is not the
 * app whose plugin registers servers into it.
 */
export const registerStandaloneApp = async (
  app: EffectAppDescriptor, options: StandaloneRegistrationOptions = {},
): Promise<StandaloneRegistration> => {
  // Refused before any socket exists: half a host is worse than none, and an app
  // that needs another app must not be made to look like one that does not.
  const missing = dependencyGaps(app, [app.id])
  if (missing.length > 0) throw dependencyError(app, missing)

  const host = makePluginHost()
  const registry = makeEffectRegistry()
  // No config face is open here, so there is nothing worth persisting: the app
  // runs on its schema defaults plus the layer the caller passed.
  const configs = makeConfigRegistry({ store: makeSqliteConfigStore({ file: ":memory:" }) })
  /** An app that declares no config has nothing to report but its own emptiness. */
  let resolved: ConfigOutcome = { ok: true, appId: app.id, value: {}, sources: {} }
  let dispose: AsyncAppDisposer | undefined
  // Idempotent without a flag of its own: the app disposer memoizes its run and
  // the config store ignores a second close.
  const stop = async (): Promise<void> => {
    try { await dispose?.() } finally { configs.close() }
  }
  try {
    dispose = await registerEffectApp({
      host, registry, configs, mcpRegistry: makeRegistry(),
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
