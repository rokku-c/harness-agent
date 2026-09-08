import type { ConfigDeclaration, ConfigLayerInput, ConfigOutcome, ConfigSaveOptions, ConfigSource } from "./contract.ts"
import { ConfigError } from "./errors.ts"
import { mergeConfig } from "./merge.ts"
import { validateStored } from "./stored.ts"
import type { ConfigStore, StoredConfig } from "./store.ts"
import { failure, isRecord, validateConfig } from "./validation.ts"

function commit(store: ConfigStore, outcome: ConfigOutcome, old?: StoredConfig): ConfigOutcome {
  if (!outcome.ok) return outcome
  const revision = (old?.revision ?? 0) + 1
  if (!Number.isSafeInteger(revision)) throw new ConfigError("config revision exhausted")
  store.write(outcome.appId, { value: outcome.value, sources: outcome.sources, revision, initialized: true })
  return { ...outcome, revision }
}

export function initializeConfig(
  store: ConfigStore, decl: ConfigDeclaration, layers: ConfigLayerInput,
): ConfigOutcome {
  const old = store.read(decl.appId)
  return old === undefined ? commit(store, mergeConfig(decl, layers)) : validateStored(decl, old)
}

const uninitialized = (appId: string) => failure(appId, `config not initialized for ${appId}; call initialize first`)

export function readConfig(store: ConfigStore, decl: ConfigDeclaration): ConfigOutcome {
  const old = store.read(decl.appId)
  return old === undefined ? uninitialized(decl.appId) : validateStored(decl, old)
}

/** Validate both the existing authority and the patch before the only write. */
export function saveConfig(
  store: ConfigStore, decl: ConfigDeclaration, patch: unknown, options: ConfigSaveOptions = {},
): ConfigOutcome {
  if (!isRecord(patch)) return failure(decl.appId, "config override must be an object")
  const old = store.read(decl.appId)
  if (old === undefined) return uninitialized(decl.appId)
  const current = validateStored(decl, old)
  if (!current.ok) return current
  const unset = options.unset ?? []
  if (unset.some((key) => Object.hasOwn(patch, key)))
    return failure(decl.appId, "config key cannot be both patched and unset")
  const changed: Record<string, ConfigSource> = Object.fromEntries(Object.keys(patch).map((key) => [key, "override"]))
  const nextValue = { ...old.value as Record<string, unknown>, ...patch }
  const nextSources = { ...old.sources, ...changed }
  for (const key of unset) {
    delete nextValue[key]
    delete nextSources[key]
  }
  return commit(store, validateConfig(decl, nextValue, nextSources), old)
}
