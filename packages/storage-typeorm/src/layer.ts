import { Effect, Layer } from "effect"
import { EventLog, Store } from "@effect-agent/state"
import { typeOrmEventLog } from "./eventlog.ts"
import { TypeOrmStore } from "./store.ts"
import type { TypeOrmStoreOptions } from "./options.ts"

export const TypeOrmPersistenceLayer = (options: TypeOrmStoreOptions = {}) =>
  (() => {
    const store = Layer.scoped(Store, Effect.acquireRelease(
      Effect.promise(() => TypeOrmStore.open(options)),
      (current) => Effect.promise(() => current.close())
    ))
    const events = Layer.effect(EventLog, Effect.map(Store, (current) =>
      typeOrmEventLog((current as TypeOrmStore).source))).pipe(Layer.provide(store))
    return Layer.merge(store, events)
  })()
