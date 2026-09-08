import type { RegistryAuth } from "./auth.ts"
import type { RegistryConfig, RegistryOptions } from "./contract.ts"

const DEFAULT_TTL_MS = 2_000
const DEFAULT_OFFLINE_MS = 60_000

export interface RuntimeConfig {
  readonly heartbeatTtlMs: number
  readonly offlineAfterMs: number
  readonly auth?: RegistryAuth
}

export interface RuntimeConfigControl {
  readonly get: () => RuntimeConfig
  readonly configure: (patch: RegistryConfig) => () => void
}

export const makeRuntimeConfig = (options: RegistryOptions): RuntimeConfigControl => {
  let current: RuntimeConfig = {
    heartbeatTtlMs: options.heartbeatTtlMs ?? DEFAULT_TTL_MS,
    offlineAfterMs: options.offlineAfterMs ?? DEFAULT_OFFLINE_MS,
    auth: options.auth,
  }
  let generation = 0
  const configure = (patch: RegistryConfig): (() => void) => {
    const previous = current, applied = ++generation
    current = { ...current, ...patch }
    return () => {
      if (generation !== applied) return
      current = previous
      generation++
    }
  }
  return { get: () => current, configure }
}
