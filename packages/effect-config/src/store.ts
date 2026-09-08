import type { ConfigSource } from "./contract.ts"

/** A complete, authoritative configuration snapshot. */
export interface StoredConfig {
  readonly value: unknown
  readonly sources: Readonly<Record<string, ConfigSource>>
  readonly revision: number
  readonly initialized: true
}

/** Synchronous storage; registry read/modify/write operations run in one transaction. */
export interface ConfigStore {
  read(appId: string): StoredConfig | undefined
  write(appId: string, record: StoredConfig): void
  transaction<T>(action: () => T): T
  close(): void
}

export interface SqliteConfigStoreOptions {
  /** Defaults to .effect-agent/config-v2.sqlite; :memory: is supported for tests. */
  readonly file?: string
}
