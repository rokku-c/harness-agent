import "reflect-metadata"
import { AsyncLocalStorage } from "node:async_hooks"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { Effect, Exit, Layer, type Cause } from "effect"
import { DataSource, MoreThanOrEqual, type EntityManager } from "typeorm"
import { Store, deriveMeta, type QuerySpec, type StoreService } from "@effect-agent/state"
import { storedEntity, type StoredEntity } from "./entity.ts"
import { eventEntity } from "./event-entity.ts"
import { sqliteOptions, type TypeOrmStoreOptions } from "./options.ts"

export class TypeOrmStore implements StoreService {
  private readonly scope = new AsyncLocalStorage<EntityManager>()
  private constructor(readonly source: DataSource) {}
  static async open(options: TypeOrmStoreOptions = {}): Promise<TypeOrmStore> {
    const config = options.dataSource ?? sqliteOptions(options.database)
    if (config.type === "sqljs" && config.location !== undefined) {
      await mkdir(dirname(String(config.location)), { recursive: true })
    } else if ((config.type === "sqlite" || config.type === "better-sqlite3") && config.database !== ":memory:") {
      await mkdir(dirname(String(config.database)), { recursive: true })
    }
    const configured = config.entities === undefined ? [] : Array.isArray(config.entities) ? config.entities : Object.values(config.entities)
    const source = new DataSource({ ...config, entities: [storedEntity, eventEntity, ...(options.entities ?? []), ...configured] } as typeof config)
    await source.initialize()
    return new TypeOrmStore(source)
  }
  private repository() { return (this.scope.getStore() ?? this.source.manager).getRepository(storedEntity) }
  get = (key: string) => Effect.promise(async () => {
    const row = await this.repository().findOneBy({ key })
    return row === null ? undefined : JSON.parse(row.value) as unknown
  })
  put = (key: string, value: unknown) => Effect.promise(async () => {
    const repository = this.repository()
    const previous = await repository.findOneBy({ key })
    const meta = deriveMeta(previous === null ? undefined : { type: previous.type, createdAt: previous.createdAt, value: previous.value }, value)
    await repository.save({ key, type: meta.type, createdAt: meta.createdAt, value: JSON.stringify(value) })
  })
  query = (spec: QuerySpec) => Effect.promise(async () => {
    const where = { ...(spec.type ? { type: spec.type } : {}), ...(spec.since ? { createdAt: MoreThanOrEqual(spec.since) } : {}) }
    const rows = await this.repository().find({ where, order: { createdAt: "ASC" }, take: spec.limit ?? 100 })
    return rows.map((row: StoredEntity) => JSON.parse(row.value) as unknown)
  })
  transaction = <A, E>(effect: Effect.Effect<A, E>) => Effect.async<A, E>((resume) => {
    this.source.transaction(async (manager) => {
      const exit = await this.scope.run(manager, () => Effect.runPromiseExit(effect))
      if (Exit.isFailure(exit)) throw exit
      return exit.value
    }).then((value) => resume(Effect.succeed(value)), (cause) =>
      resume(Exit.isFailure(cause) ? Effect.failCause(cause.cause as Cause.Cause<E>) : Effect.die(cause)))
  })
  close = () => this.source.destroy()
}

export const TypeOrmStoreLayer = (options: TypeOrmStoreOptions = {}): Layer.Layer<Store> =>
  Layer.scoped(Store, Effect.acquireRelease(Effect.promise(() => TypeOrmStore.open(options)), (store) => Effect.promise(() => store.close())))
