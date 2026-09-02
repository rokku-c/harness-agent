/**
 * The provider catalog: providers.toml (or config.toml) + .env resolve into
 * Models and, through EffectAgent, Drivers. Providers are configuration,
 * not architecture - the agent API never names a provider.
 *
 * The model half (config parsing, Model building) lives in @effect-agent/model;
 * this file only adds the driver-building step, so the builtin surface
 * (Providers/ProviderCatalog/loadProviders) is unchanged.
 */
import { Context, Effect, Layer } from "effect"
import { AgentFailure, type Driver } from "@effect-agent/core"
import {
  loadModelCatalog,
  type ModelCatalogService,
  type LoadModelCatalogOptions,
  type ProviderConfigError
} from "@effect-agent/model"
import { EffectAgent, type EffectAgentOptions } from "./loop.ts"

export type { LoadModelCatalogOptions as LoadProvidersOptions, ProviderConfig, ProviderConfigError } from "@effect-agent/model"

export interface ProviderCatalog extends ModelCatalogService {
  readonly agent: (name?: string, options?: Omit<EffectAgentOptions, "model">) => Driver
}

export const loadProviders = (options: LoadModelCatalogOptions = {}): Effect.Effect<ProviderCatalog, ProviderConfigError> =>
  Effect.map(loadModelCatalog(options), (base) => new ProviderCatalogImpl(base))

class ProviderCatalogImpl implements ProviderCatalog {
  constructor(private readonly base: ModelCatalogService) {}
  get names(): ReadonlyArray<string> {
    return this.base.names
  }
  config = (name?: string) => this.base.config(name)
  model = (name?: string) => this.base.model(name)
  agent = (name?: string, options?: Omit<EffectAgentOptions, "model">): Driver =>
    EffectAgent.make({ ...options, model: this.base.model(name) })
}

/** The Providers service: the config-driven catalog behind Providers.agent(). */
export class Providers extends Context.Tag("builtin/Providers")<Providers, ProviderCatalog>() {
  static layer = (options: LoadModelCatalogOptions = {}): Layer.Layer<Providers, ProviderConfigError> =>
    Layer.effect(Providers, loadProviders(options))

  /** The default driver from the configured provider. */
  static agent = (name?: string, options?: Omit<EffectAgentOptions, "model">) =>
    Effect.map(Providers, (catalog) => catalog.agent(name, options))
}

export { AgentFailure }
