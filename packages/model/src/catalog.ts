/**
 * The model catalog: providers.toml (or config.toml) + .env resolve into
 * Models. Configuration, not architecture - the agent API never names a
 * provider. (The driver-building half of the old builtin Providers stays in
 * builtin; this package only builds models.)
 */
import { Context, Data, Effect, Layer } from "effect"
import { existsSync, readFileSync } from "node:fs"
import { anthropicModel, type AnthropicConfig } from "./anthropic.ts"
import { openaiModel, type OpenAiConfig } from "./openai.ts"
import type { Model } from "./types.ts"

export type ProviderConfig = OpenAiConfig | AnthropicConfig

export class ProviderConfigError extends Data.TaggedError("ProviderConfigError")<{
  readonly path: string
  readonly message: string
}> {}

const parseEnv = (source: string): Record<string, string> => {
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

export interface ModelCatalogService {
  readonly names: ReadonlyArray<string>
  readonly config: (name?: string) => ProviderConfig
  readonly model: (name?: string) => Model
}

export class ModelCatalog extends Context.Tag("effect-agent/ModelCatalog")<ModelCatalog, ModelCatalogService>() {}

export interface LoadModelCatalogOptions {
  readonly path?: string
  readonly envFile?: string | false
  readonly env?: Readonly<Record<string, string | undefined>>
}

const buildModel = (config: ProviderConfig): Model =>
  config.api === "openai.chat" ? openaiModel(config) : anthropicModel(config)

export class ModelCatalogImpl implements ModelCatalogService {
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
}

export const loadModelCatalog = (options: LoadModelCatalogOptions = {}): Effect.Effect<ModelCatalogService, ProviderConfigError> =>
  Effect.try({
    try: () => {
      const path = options.path ?? "config.toml"
      if (!existsSync(path)) throw new ProviderConfigError({ path, message: "provider config file not found" })
      const envFile = options.envFile === undefined ? ".env" : options.envFile
      const fileEnv = envFile && existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {}
      const env = { ...fileEnv, ...process.env, ...options.env }
      const document = resolveTree((Bun as any).TOML.parse(readFileSync(path, "utf8")), env, path)
      return new ModelCatalogImpl(validate(document, path))
    },
    catch: (cause) => (cause instanceof ProviderConfigError ? cause : new ProviderConfigError({ path: "providers", message: String(cause) }))
  })

export const ModelCatalogLayer = (options: LoadModelCatalogOptions = {}): Layer.Layer<ModelCatalog, ProviderConfigError> =>
  Layer.effect(ModelCatalog, loadModelCatalog(options))
