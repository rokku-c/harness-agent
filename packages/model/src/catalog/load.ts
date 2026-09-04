/**
 * catalog/load.ts - LOADING: TOML document -> ModelCatalog.
 *
 * Concept: read providers.toml/config.toml (Bun TOML), resolve env refs,
 * validate every [providers.<name>] table (supported api + a model string),
 * and expose the result as the ModelCatalog service (a layer for the
 * runtime). Driver-building belongs to builtin; this only builds models.
 */
import { Effect, Layer } from "effect"
import { existsSync, readFileSync } from "node:fs"
import { anthropicModel } from "../anthropic.ts"
import { openaiModel } from "../openai.ts"
import type { Model } from "../types.ts"
import { parseEnv, resolveTree } from "./resolve.ts"
import { ModelCatalog, ProviderConfigError, type ModelCatalogService, type ProviderConfig } from "./contract.ts"

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

const buildModel = (config: ProviderConfig): Model =>
  config.api === "openai.chat" ? openaiModel(config) : anthropicModel(config)

export class ModelCatalogImpl implements ModelCatalogService {
  constructor(readonly providers: Record<string, ProviderConfig>) {}
  get names(): ReadonlyArray<string> {
    return Object.keys(this.providers)
  }
  config = (name?: string): ProviderConfig => {
    const config = this.providers[name ?? Object.keys(this.providers)[0] ?? ""]
    if (config === undefined)
      throw new ProviderConfigError({ path: "providers", message: "no provider named " + String(name) })
    return config
  }
  model = (name?: string): Model => buildModel(this.config(name))
}

export interface LoadModelCatalogOptions {
  readonly path?: string
  readonly envFile?: string | false
  readonly env?: Readonly<Record<string, string | undefined>>
}

export const loadModelCatalog = (options: LoadModelCatalogOptions = {}): Effect.Effect<ModelCatalogService, ProviderConfigError> =>
  Effect.try({
    try: () => {
      const path = options.path ?? "config.toml"
      if (!existsSync(path)) throw new ProviderConfigError({ path, message: "provider config file not found" })
      const envFile = options.envFile === undefined ? ".env" : options.envFile
      const fileEnv = envFile && existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {}
      const env = { ...fileEnv, ...process.env, ...options.env }
      const document = resolveTree((Bun as any).TOML.parse(readFileSync(path, "utf8")), env, path, ProviderConfigError)
      return new ModelCatalogImpl(validate(document, path))
    },
    catch: (cause) =>
      cause instanceof ProviderConfigError
        ? cause
        : new ProviderConfigError({ path: "providers", message: String(cause) })
  })

export const ModelCatalogLayer = (options: LoadModelCatalogOptions = {}): Layer.Layer<ModelCatalog, ProviderConfigError> =>
  Layer.effect(ModelCatalog, loadModelCatalog(options))
