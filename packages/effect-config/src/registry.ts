/**
 * effect-config registry — where apps declare their configuration.
 *
 * register(declaration) is reversible (returns a disposer), matching the
 * effect-host/interface registries. `apply(appId, layers)` merges defaults +
 * effect.yaml + override and validates, returning provenance per key.
 */

import { z } from "zod"
import { initializeConfig, readConfig, saveConfig } from "./persistence.ts"
import { makeSqliteConfigStore } from "./sqlite.ts"
import type { ConfigStore } from "./store.ts"
import { storageFailure, failure } from "./validation.ts"
import {
  mergeConfig,
  toJsonSchema,
  type ConfigDeclaration,
  type ConfigLayerInput,
  type ConfigOutcome,
  type ConfigSaveOptions,
} from "./contract.ts"

export interface ConfigRegistry {
  register<S extends z.ZodType>(decl: ConfigDeclaration<S>): () => void
  unregister(appId: string): boolean
  list(): readonly ConfigDeclaration[]
  get(appId: string): ConfigDeclaration | undefined
  schemaFor(appId: string): unknown | undefined
  apply(appId: string, layers?: ConfigLayerInput): ConfigOutcome
  initialize(appId: string, layers?: ConfigLayerInput): ConfigOutcome
  /** Validate the committed DB record without normalizing or rewriting it. */
  read(appId: string): ConfigOutcome
  save(appId: string, override: unknown, options?: ConfigSaveOptions): ConfigOutcome
  /** Close only the lazily-created default store; injected stores belong to the caller. */
  close(): void
}

export interface ConfigRegistryOptions { readonly store?: ConfigStore }

export const makeConfigRegistry = (options: ConfigRegistryOptions = {}): ConfigRegistry => {
  const declarations = new Map<string, ConfigDeclaration>()
  let store = options.store
  let closed = false
  const persisted = (appId: string, action: (store: ConfigStore, decl: ConfigDeclaration) => ConfigOutcome) => {
    const decl = declarations.get(appId)
    if (!decl) return failure(appId, "no config declared for " + appId)
    if (closed) return failure(appId, "config registry is closed")
    try {
      const activeStore = store ??= makeSqliteConfigStore()
      return activeStore.transaction(() => action(activeStore, decl))
    } catch (error) {
      return storageFailure(appId, error)
    }
  }

  return {
    initialize: (appId, layers = {}) => persisted(appId, (store, decl) => initializeConfig(store, decl, layers)),
    read: (appId) => persisted(appId, readConfig),
    save: (appId, override, options) => persisted(appId, (store, decl) => saveConfig(store, decl, override, options)),
    close() { if (!options.store) store?.close(); closed = true },
    register<S extends z.ZodType>(decl: ConfigDeclaration<S>): () => void {
      declarations.set(decl.appId, decl)
      let disposed = false
      return () => {
        if (disposed) return
        disposed = true
        if (declarations.get(decl.appId) === decl) declarations.delete(decl.appId)
      }
    },

    unregister(appId: string): boolean {
      return declarations.delete(appId)
    },

    list(): readonly ConfigDeclaration[] {
      return [...declarations.values()]
    },

    get(appId: string): ConfigDeclaration | undefined {
      return declarations.get(appId)
    },

    schemaFor(appId: string): unknown | undefined {
      const decl = declarations.get(appId)
      return decl !== undefined ? toJsonSchema(decl.schema) : undefined
    },

    apply(appId: string, layers: ConfigLayerInput = {}): ConfigOutcome {
      const decl = declarations.get(appId)
      if (decl === undefined) {
        return { ok: false, appId, value: {}, sources: {}, error: "no config declared for " + appId }
      }
      return mergeConfig(decl, layers)
    },
  }
}
