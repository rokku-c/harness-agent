import { Context, Data, Effect, Layer } from "effect"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"
import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { EffectAgent } from "./effect.js"
import { NativeAgent } from "./native.js"
import { VercelAgent, type VercelOptions } from "./vercel.js"
import type { Driver } from "@effect-agent/core"
import { MaxOutputTokens, ProviderDefaults, type MaxOutputTokensConfig } from "@effect-agent/core"

export { EffectAgent } from "./effect.js"
export { NativeAgent } from "./native.js"
export { VercelAgent, type VercelOptions } from "./vercel.js"

export type ProviderApi =
  | "openai.responses"
  | "openai.chat"
  | "openai.completions"
  | "anthropic.messages"

/** Which driver implements the provider. "native" uses the official SDKs directly
 *  (bypassing @ai-sdk/*, which mis-validates some gateways' thinking blocks); "vercel"
 *  uses the @ai-sdk/* compatibility layer. Default "native". */
export type ProviderDriver = "native" | "vercel" | "effect"

export interface ProviderConfig {
  readonly api: ProviderApi
  readonly model: string
  readonly apiKey?: string
  readonly baseURL?: string
  readonly headers?: Readonly<Record<string, string>>
  /** Max-output-tokens escalation policy, or a plain number for the `default` value alone. */
  readonly maxOutputTokens?: number | MaxOutputTokensConfig
  readonly driver?: ProviderDriver
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

const parseEnv = (source: string) =>
  source.split(/\r?\n/).reduce<Record<string, string>>((values, raw) => {
    const line = raw.trim().replace(/^export\s+/, "")
    if (!line || line.startsWith("#")) return values
    const split = line.indexOf("=")
    if (split < 1) return values
    const key = line.slice(0, split).trim()
    let value = line.slice(split + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1)
    return { ...values, [key]: value }
  }, {})

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
  const invalid = Object.entries(config.providers).find(([name, provider]) => {
    if (!provider || !APIS.has(provider.api) || typeof provider.model !== "string")
      return true
    const mot = provider.maxOutputTokens
    if (mot === undefined) return false
    // 单个数字：必须是正整数；策略对象：default 必须是正整数。
    const isConfig = (v: unknown): v is MaxOutputTokensConfig =>
      typeof v === "object" && v !== null && typeof (v as MaxOutputTokensConfig).default === "number"
    return typeof mot === "number"
      ? !(Number.isInteger(mot) && mot > 0)
      : !(isConfig(mot) && Number.isInteger(mot.default) && mot.default > 0)
  })
  if (invalid) {
    const [name, provider] = invalid
    if (!provider || !APIS.has(provider.api) || typeof provider.model !== "string")
      throw new ProviderConfigError({ path, message: `providers.${name} requires a supported api and model` })
    throw new ProviderConfigError({ path, message: `providers.${name}.maxOutputTokens must be a positive integer or an object with a positive integer "default"` })
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

/** Normalize a `number | MaxOutputTokensConfig` into a full policy. */
const normalizeMaxOutputTokens = (value?: number | MaxOutputTokensConfig): MaxOutputTokensConfig =>
  typeof value === "number"
    ? { ...MaxOutputTokens, default: value }
    : value ?? MaxOutputTokens

/** Build an official SDK client for the native driver. */
const buildNativeClient = (config: ProviderConfig): Anthropic | OpenAI => {
  const headers = config.headers ? { ...config.headers } as Record<string, string> : undefined
  switch (config.api) {
    case "openai.responses":
    case "openai.chat":
    case "openai.completions":
      return new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, ...(headers ? { defaultHeaders: headers } : {}) })
    case "anthropic.messages":
      // Anthropic 官方 SDK 的 apiKey 期望 sk-ant- 前缀；兼容网关（如 deepseek）的 key 不是
      // 这个格式时，用 authToken（直接作为 Bearer）更可靠。两者都传让 SDK 按需选用。
      return new Anthropic({
        ...(config.apiKey ? { apiKey: config.apiKey, authToken: config.apiKey } : {}),
        baseURL: config.baseURL,
        ...(headers ? { defaultHeaders: headers } : {})
      })
  }
}

export interface ProviderCatalog {
  readonly names: ReadonlyArray<string>
  readonly default?: string
  readonly config: (name?: string) => ProviderConfig
  readonly model: (name?: string) => LanguageModel
  readonly agent: (name?: string, options?: ProviderAgentOptions) => Driver
}

/** Options for `ProviderCatalog.agent` — driver selection plus driver-specific options. */
export interface ProviderAgentOptions extends Omit<VercelOptions, "model"> {
  readonly driver?: ProviderDriver
}

export interface LoadProvidersOptions {
  readonly path?: string
  readonly envFile?: string | false
  readonly env?: Readonly<Record<string, string | undefined>>
}

export const loadToml = (options: LoadProvidersOptions = {}) => Effect.tryPromise({
  try: async () => {
    const path = options.path ?? ProviderDefaults.configPath
    const envFile = options.envFile === undefined ? ".env" : options.envFile
    const fileEnv = envFile && await Bun.file(envFile).exists() ? parseEnv(await Bun.file(envFile).text()) : {}
    const env = { ...fileEnv, ...process.env, ...options.env }
    return resolveTree(Bun.TOML.parse(await Bun.file(path).text()), env, path)
  },
  catch: (cause) => cause instanceof ProviderConfigError
    ? cause
    : new ProviderConfigError({ path: options.path ?? ProviderDefaults.configPath, message: String(cause) })
})

export const loadProviders = (options: LoadProvidersOptions = {}) => loadToml(options).pipe(
  Effect.flatMap((document) => Effect.try({
  try: (): ProviderCatalog => {
    const path = options.path ?? ProviderDefaults.configPath
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
        const driverKind = agentOptions?.driver ?? selected.driver ?? ProviderDefaults.driver
        const maxOutputTokens = normalizeMaxOutputTokens(agentOptions?.maxOutputTokens ?? selected.maxOutputTokens)
        if (driverKind === "native") {
          return NativeAgent.make({
            client: buildNativeClient(selected),
            api: selected.api,
            model: selected.model,
            maxOutputTokens
          })
        }
        if (driverKind === "effect") {
          return EffectAgent.make({
            api: selected.api,
            model: selected.model,
            apiKey: selected.apiKey,
            baseURL: selected.baseURL,
            maxOutputTokens
          })
        }
        return VercelAgent.make({
          ...agentOptions,
          api: selected.api,
          model: buildModel(selected),
          maxOutputTokens
        })
      }
    }
  },
  catch: (cause) => cause instanceof ProviderConfigError
    ? cause
    : new ProviderConfigError({ path: options.path ?? ProviderDefaults.configPath, message: String(cause) })
  }))
)

export class Providers extends Context.Tag("effect-agent/Providers")<Providers, ProviderCatalog>() {
  static layer(options: LoadProvidersOptions = {}) {
    return Layer.effect(this, loadProviders(options))
  }

  static agent(name?: string, options?: ProviderAgentOptions) {
    return Effect.map(this, (providers) => providers.agent(name, options))
  }
}
