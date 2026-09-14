import { Context, Data } from "effect"
import type { Model } from "../types.ts"
import type { AnthropicConfig } from "../anthropic.ts"
import type { OpenAiConfig } from "../openai.ts"

export type ProviderConfig = OpenAiConfig | AnthropicConfig

export class ProviderConfigError extends Data.TaggedError("ProviderConfigError")<{
  readonly path: string
  readonly message: string
}> {}

export interface ModelCatalogService {
  readonly names: ReadonlyArray<string>
  readonly config: (name?: string) => ProviderConfig
  readonly model: (name?: string) => Model
}

export class ModelCatalog extends Context.Tag("effect-agent/ModelCatalog")<ModelCatalog, ModelCatalogService>() {}
