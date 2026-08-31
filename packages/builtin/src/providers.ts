/**
 * The provider catalog: agents.toml (or config.toml) + .env resolve into
 * Models and, through EffectAgent, Drivers. Providers are configuration,
 * not architecture - the agent API never names a provider.
 */
import { Context, Data, Effect, Layer } from "effect"
import { existsSync, readFileSync } from "node:fs"
import { AgentFailure, type Driver } from "@effect-agent/core"
import { anthropicModel, openaiModel, type Model, type OpenAiConfig, type AnthropicConfig } from "./wire.ts"
import { EffectAgent, type EffectAgentOptions } from "./loop.ts"

export type ProviderConfig = OpenAiConfig | AnthropicConfig

export class ProviderConfigError extends Data.TaggedError("ProviderConfigError")<{
  readonly path: string
  readonly message: string
}> {}

const parseEnv = (source: string) => {
  const values: Record<string, string> = {}
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, "")
    if (!line || line.startsWith("#")) continue
    const split = line.indexOf("=")
    if (split < 1) continue
    const key = line.slice(0, split).trim()
    let value = line.slice(split + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1)
    values[key] = value
  }
  return values
}

const ENV_REFERENCE = /\$\{([A-Z_][A-Z0-9_]*)\}/g

const resolveTree = (value: unknown, env: Readonly<Record<string, string | undefined>>, path: string): unknown => {
  if (typeof value === "string") {
    const direct = value.match(/^env:([A-Z_][A-Z0-9_]*)$/)?.[1]
    if (direct) {
      const found = env[direct]
      if (found === undefined)
        throw new ProviderConfigError({ path, message: "Environment variable " + direct + " is not defined" })
      return found
    }
    return value.replace(ENV_REFERENCE, (_match, key: string) => {
      const found = env[key]
      if (found === undefined)
        throw new ProviderConfigError({ path, message: "Environment variable " + key + " is not defined" })
      return found
    })
  }
  if (Array.isArray(value)) return value.map((item) => resolveTree(item, env, path))
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveTree(item, env, path + "." + key)])
    )
  return value
}

const APIS = ["openai.chat", "anthropic.messages"] as const

const validate = (value: unknown, path: string): Record<string, ProviderConfig> => {
  const document = value as { providers?: Record<string, Partial<ProviderConfig>>; default?: string }
  if (!document?.providers || typeof document.providers !== "object")
    throw new ProviderConfigError({ path, message: "TOML must contain [providers.<name>] tables" })
  const providers: Record<string, ProviderConfig> = {}
  for (const [name, provider] of Object.entries(document.providers)) {
    if (!provider || !APIS.includes(provider.api as any) || typeof provider.model !== "string")
      throw new ProviderConfigError({ path, message: "providers." + name + " requires a supported api and model" })
    providers[name] = provider as ProviderConfig
  }
  return providers
}

export interface LoadProvidersOptions {
  readonly path?: string
  readonly envFile?: string | false
  readonly env?: Readonly<Record<string, string | undefined>>
}

export const loadProviders = (options: LoadProvidersOptions = {}): Effect.Effect<ProviderCatalog, ProviderConfigError> =>
  Effect.try({
    try: () => {
      const path = options.path ?? "config.toml"
      if (!existsSync(path)) throw new ProviderConfigError({ path, message: "provider config file not found" })
      const envFile = options.envFile === undefined ? ".env" : options.envFile
      const fileEnv = envFile && existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {}
      const env = { ...fileEnv, ...process.env, ...options.env }
      const document = resolveTree(Bun.TOML.parse(readFileSync(path, "utf8")), env, path)
      return new ProviderCatalogImpl(validate(document, path))
    },
    catch: (cause) => (cause instanceof ProviderConfigError ? cause : new ProviderConfigError({ path: "providers", message: String(cause) }))
  })

export interface ProviderCatalog {
  readonly names: ReadonlyArray<string>
  readonly config: (name?: string) => ProviderConfig
  readonly model: (name?: string) => Model
  readonly agent: (name?: string, options?: Omit<EffectAgentOptions, "model">) => Driver
}

const buildModel = (config: ProviderConfig): Model =>
  config.api === "openai.chat" ? openaiModel(config) : anthropicModel(config)

class ProviderCatalogImpl implements ProviderCatalog {
  constructor(readonly providers: Record<string, ProviderConfig>) {}
  get names(): ReadonlyArray<string> {
    return Object.keys(this.providers)
  }
  config = (name?: string): ProviderConfig => {
    const config = this.providers[name ?? Object.keys(this.providers)[0] ?? ""]
    if (config === undefined) throw new ProviderConfigError({ path: "providers", message: "no provider named " + String(name) })
    return config
  }
  model = (name?: string): Model => buildModel(this.config(name))
  agent = (name?: string, options?: Omit<EffectAgentOptions, "model">): Driver =>
    EffectAgent.make({ ...options, model: this.model(name) })
}

/** The Providers service: the config-driven catalog behind Providers.agent(). */
export class Providers extends Context.Tag("builtin/Providers")<Providers, ProviderCatalog>() {
  static layer = (options: LoadProvidersOptions = {}): Layer.Layer<Providers, ProviderConfigError> =>
    Layer.effect(Providers, loadProviders(options))

  /** The default driver from the configured provider. */
  static agent = (name?: string, options?: Omit<EffectAgentOptions, "model">) =>
    Effect.map(Providers, (catalog) => catalog.agent(name, options))
}

export { AgentFailure }

