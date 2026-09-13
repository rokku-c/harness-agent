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
  /**
   * Discard one app's durable record — the only supported rebuild step. It is
   * per-app on purpose: one stale row must not cost the other apps their config,
   * so "delete the store and start over" is not the same operation and is not
   * offered here. Dropping is also all this does: the record is re-seeded from
   * the current schema and the caller's layers by the next `initialize`, which is
   * the only place that knows those layers (an effect.yaml layer is not
   * recoverable from the store, so re-seeding here would silently lose it).
   */
  remove(appId: string): void
  transaction<T>(action: () => T): T
  close(): void
}

export interface SqliteConfigStoreOptions {
  /** Defaults to .effect-agent/config-v2.sqlite; :memory: is supported for tests. */
  readonly file?: string
}
