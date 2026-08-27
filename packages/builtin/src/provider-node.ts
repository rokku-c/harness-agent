import { generateText, type LanguageModel } from "ai"
import { Effect } from "effect"
import type { AdapterRef, CapabilitySpec, ConnectionAdapter, ConnectionSpec, JsonSchema, JsonValue } from "@effect-agent/core"

export const ProviderCapabilities = {
  list: "provider/list",
  get: "provider/get",
  generate: "provider/generate",
  stream: "provider/stream"
} as const
export type ProviderCapability = typeof ProviderCapabilities[keyof typeof ProviderCapabilities]

export interface ProviderConfig {
  readonly api: string
  readonly model: string
  readonly apiKey?: string
  readonly baseURL?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly maxOutputTokens?: number
  readonly [key: string]: JsonValue | undefined
}

export interface ProviderResolver {
  readonly names: ReadonlyArray<string>
  readonly default?: string
  readonly config: (name?: string) => ProviderConfig
  readonly model: (name?: string) => LanguageModel
}

const objectSchema: JsonSchema = { type: "object", additionalProperties: true }
const stringSchema: JsonSchema = { type: "string" }
const capabilities: Readonly<Record<ProviderCapability, CapabilitySpec>> = {
  [ProviderCapabilities.list]: { name: ProviderCapabilities.list, input: objectSchema, output: objectSchema, mode: "read" },
  [ProviderCapabilities.get]: { name: ProviderCapabilities.get, input: objectSchema, output: objectSchema, mode: "read" },
  [ProviderCapabilities.generate]: { name: ProviderCapabilities.generate, input: { type: "object", properties: { prompt: stringSchema, provider: stringSchema }, required: ["prompt"], additionalProperties: true }, output: objectSchema, mode: "control" },
  [ProviderCapabilities.stream]: { name: ProviderCapabilities.stream, input: { type: "object", properties: { prompt: stringSchema, provider: stringSchema }, required: ["prompt"], additionalProperties: true }, output: objectSchema, mode: "control" }
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const promise = <A>(run: () => Promise<A>) => Effect.tryPromise({ try: run, catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)) })

export interface ProviderAdapterOptions {
  readonly kind?: string
  readonly resolver: ProviderResolver
  readonly generate?: typeof generateText
}

/** Provider configuration and model invocation as a capability-scoped Connection. */
export const providerAdapter = (options: ProviderAdapterOptions): ConnectionAdapter => {
  const kind = options.kind ?? "builtin.provider"
  const generate = options.generate ?? generateText
  return {
    kind,
    capabilities: new Set(Object.values(ProviderCapabilities)),
    connect: (spec) => Effect.succeed({
      connectionId: spec.id,
      adapter: kind,
      capabilities: new Set(Object.values(ProviderCapabilities)),
      invoke: (capability, raw) => {
        const input = record(raw)
        switch (capability) {
          case ProviderCapabilities.list: return Effect.succeed({ names: options.resolver.names, default: options.resolver.default })
          case ProviderCapabilities.get: {
            const name = typeof input.name === "string" ? input.name : undefined
            return Effect.try({ try: () => options.resolver.config(name), catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)) })
          }
          case ProviderCapabilities.generate: {
            if (typeof input.prompt !== "string") return Effect.fail(new Error("provider/generate requires prompt"))
            return promise(() => generate({
              model: options.resolver.model(typeof input.provider === "string" ? input.provider : undefined),
              prompt: input.prompt as string,
              ...(typeof input.maxOutputTokens === "number" ? { maxOutputTokens: input.maxOutputTokens } : {})
            })).pipe(Effect.map((result) => ({ text: result.text, usage: result.usage, finishReason: result.finishReason })))
          }
          case ProviderCapabilities.stream:
            return Effect.fail(new Error("provider/stream requires a streaming transport; use provider/generate or a stream adapter"))
          default: return Effect.fail(new Error(`Unsupported provider capability: ${capability}`))
        }
      },
      close: Effect.void
    }),
  }
}

export const providerConnectionSpec = (options: {
  readonly id: string
  readonly adapters: ReadonlyArray<AdapterRef>
  readonly capabilities?: ReadonlyArray<ProviderCapability>
}): ConnectionSpec => ({
  id: options.id,
  contract: { protocol: "effect-agent.provider/v1", capabilities: (options.capabilities ?? [ProviderCapabilities.list, ProviderCapabilities.get, ProviderCapabilities.generate]).map((name) => capabilities[name]) },
  adapters: options.adapters,
  selection: { strategy: "failover" }
})
