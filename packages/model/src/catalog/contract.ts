/**
 * catalog/contract.ts - the CATALOG CONTRACT (types + tag + error).
 *
 * Concept: what a model catalog IS - providers.toml/config.toml resolve into
 * named Model factories; the agent API never names a provider. This file
 * owns the shapes and the service tag; resolution and loading live in the
 * sibling files.
 */
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
