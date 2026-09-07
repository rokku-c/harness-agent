import type { DataSourceOptions, EntitySchema } from "typeorm"

export interface TypeOrmStoreOptions {
  readonly database?: string
  readonly dataSource?: DataSourceOptions
  readonly entities?: ReadonlyArray<EntitySchema>
}

export const sqliteOptions = (database = ".effect-agent/state.sqlite"): DataSourceOptions => ({
  type: "sqljs",
  ...(database === ":memory:" ? {} : { location: database, autoSave: true }),
  synchronize: true,
  dropSchema: false
})
