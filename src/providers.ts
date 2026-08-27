import { Context, Data, Effect, Layer } from "effect"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"
import { VercelAgent, type VercelOptions } from "./vercel.js"
import type { Driver } from "./core.js"

export type ProviderApi =
  | "openai.responses"
  | "openai.chat"
  | "openai.completions"
  | "anthropic.messages"

export interface ProviderConfig {
  readonly api: ProviderApi
  readonly model: string
  readonly apiKey?: string
  readonly baseURL?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly maxOutputTokens?: number
}

interface TomlConfig {
  readonly default?: string
  readonly providers: Readonly<Record<string, ProviderConfig>>
}

export class ProviderConfigError extends Data.TaggedError("ProviderConfigError")<{
  readonly path: string
  readonly message: string
}> {}

const ENV_REFERENCE = /\$\{([A-Z_][A-Z0-9_]*)\}/g

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

const resolveString = (value: string, env: Readonly<Record<string, string | undefined>>, path: string) => {
  const direct = value.match(/^env:([A-Z_][A-Z0-9_]*)$/)?.[1]
  const resolve = (key: string) => {
    const found = env[key]
    if (found === undefined) throw new ProviderConfigError({ path, message: `Environment variable ${key} is not defined` })
    return found
  }
  return direct ? resolve(direct) : value.replace(ENV_REFERENCE, (_match, key: string) => resolve(key))
}

const resolveTree = (value: unknown, env: Readonly<Record<string, string | undefined>>, path: string): unknown => {
  if (typeof value === "string") return resolveString(value, env, path)
  if (Array.isArray(value)) return value.map((item) => resolveTree(item, env, path))
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, resolveTree(item, env, `${path}.${key}`)])
  )
  return value
}

const APIS = new Set<ProviderApi>([
  "openai.responses", "openai.chat", "openai.completions", "anthropic.messages"
])

const validate = (value: unknown, path: string): TomlConfig => {
  const config = value as Partial<TomlConfig>
  if (!config || typeof config !== "object" || !config.providers || typeof config.providers !== "object")
    throw new ProviderConfigError({ path, message: "TOML must contain [providers.<name>] tables" })
  for (const [name, provider] of Object.entries(config.providers)) {
    if (!provider || !APIS.has(provider.api) || typeof provider.model !== "string")
      throw new ProviderConfigError({ path, message: `providers.${name} requires a supported api and model` })
    if (provider.maxOutputTokens !== undefined && (!Number.isInteger(provider.maxOutputTokens) || provider.maxOutputTokens < 1))
      throw new ProviderConfigError({ path, message: `providers.${name}.maxOutputTokens must be a positive integer` })
  }
  if (config.default && !config.providers[config.default])
    throw new ProviderConfigError({ path, message: `Default provider ${config.default} does not exist` })
  return config as TomlConfig
}

const buildModel = (config: ProviderConfig): LanguageModel => {
  const common = { apiKey: config.apiKey, baseURL: config.baseURL, headers: config.headers }
  switch (config.api) {
    case "openai.responses": return createOpenAI(common).responses(config.model)
    case "openai.chat": return createOpenAI(common).chat(config.model)
    case "openai.completions": return createOpenAI(common).completion(config.model)
    case "anthropic.messages": return createAnthropic(common).messages(config.model)
  }
}

export interface ProviderCatalog {
  readonly names: ReadonlyArray<string>
  readonly default?: string
  readonly config: (name?: string) => ProviderConfig
  readonly model: (name?: string) => LanguageModel
  readonly agent: (name?: string, options?: Omit<VercelOptions, "model">) => Driver
}

export interface LoadProvidersOptions {
  readonly path?: string
  readonly envFile?: string | false
  readonly env?: Readonly<Record<string, string | undefined>>
}

export const loadToml = (options: LoadProvidersOptions = {}) => Effect.tryPromise({
  try: async () => {
    const path = options.path ?? "agents.toml"
    const envFile = options.envFile === undefined ? ".env" : options.envFile
    const fileEnv = envFile && await Bun.file(envFile).exists() ? parseEnv(await Bun.file(envFile).text()) : {}
    const env = { ...fileEnv, ...process.env, ...options.env }
    return resolveTree(Bun.TOML.parse(await Bun.file(path).text()), env, path)
  },
  catch: (cause) => cause instanceof ProviderConfigError
    ? cause
    : new ProviderConfigError({
        path: options.path ?? "agents.toml",
        message: (cause instanceof Error && (cause as { code?: string }).code === "ENOENT")
          ? `file not found: copy config.toml.example to ${options.path ?? "agents.toml"} and fill in API keys`
          : String(cause)
      })
})

export const loadProviders = (options: LoadProvidersOptions = {}) => loadToml(options).pipe(
  Effect.flatMap((document) => Effect.try({
  try: (): ProviderCatalog => {
    const path = options.path ?? "agents.toml"
    const config = validate(document, path)
    const select = (name = config.default ?? "") => {
      const selected = config.providers[name]
      if (!selected) throw new ProviderConfigError({ path, message: `Provider ${name || "<default>"} does not exist` })
      return selected
    }
    return {
      names: Object.keys(config.providers),
      default: config.default,
      config: select,
      model: (name) => buildModel(select(name)),
      agent: (name, agentOptions) => {
        const selected = select(name)
        return VercelAgent.make({
          ...agentOptions,
          api: selected.api,
          model: buildModel(selected),
          maxOutputTokens: agentOptions?.maxOutputTokens ?? selected.maxOutputTokens
        })
      }
    }
  },
  catch: (cause) => cause instanceof ProviderConfigError
    ? cause
    : new ProviderConfigError({ path: options.path ?? "agents.toml", message: String(cause) })
  }))
)

export class Providers extends Context.Tag("effect-agent/Providers")<Providers, ProviderCatalog>() {
  static layer(options: LoadProvidersOptions = {}) {
    return Layer.effect(this, loadProviders(options))
  }

  static agent(name?: string, options?: Omit<VercelOptions, "model" | "api">) {
    return Effect.map(this, (providers) => providers.agent(name, options))
  }
}
