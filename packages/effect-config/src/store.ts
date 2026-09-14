import type { ConfigSource } from "./contract.ts"

export interface StoredConfig {
  readonly value: unknown
  readonly sources: Readonly<Record<string, ConfigSource>>
  readonly revision: number
  readonly initialized: true
}

export interface ConfigStore {
  read(appId: string): StoredConfig | undefined
  write(appId: string, record: StoredConfig): void
  remove(appId: string): void
  transaction<T>(action: () => T): T
  close(): void
}

export interface SqliteConfigStoreOptions {
  readonly file?: string
}
