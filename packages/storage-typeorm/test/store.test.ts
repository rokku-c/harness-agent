import { expect, test } from "bun:test"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Effect } from "effect"
import { EntitySchema } from "typeorm"
import { TypeOrmStore } from "../src/index.ts"

test("uses SQLite by default and persists dynamic values", async () => {
  const database = join(tmpdir(), `effect-agent-${crypto.randomUUID()}.sqlite`)
  const first = await TypeOrmStore.open({ database })
  await Effect.runPromise(first.put("event/1", { type: "gateway.event", detail: { status: 200 } }))
  await first.close()
  const second = await TypeOrmStore.open({ database })
  expect(await Effect.runPromise(second.get("event/1"))).toEqual({ type: "gateway.event", detail: { status: 200 } })
  expect(await Effect.runPromise(second.query({ type: "gateway.event" }))).toHaveLength(1)
  await second.close()
})

test("rolls back writes when a TypeORM transaction fails", async () => {
  const store = await TypeOrmStore.open({ database: ":memory:" })
  const operation = store.transaction(Effect.gen(function* () {
    yield* store.put("rolled-back", { type: "test" })
    return yield* Effect.fail("stop")
  }))
  expect((await Effect.runPromiseExit(operation))._tag).toBe("Failure")
  expect(await Effect.runPromise(store.get("rolled-back"))).toBeUndefined()
  await store.close()
})

test("registers additional EntitySchema definitions at runtime", async () => {
  const note = new EntitySchema<{ id: string; text: string }>({
    name: "DynamicNote",
    columns: { id: { type: String, primary: true }, text: { type: String } }
  })
  const store = await TypeOrmStore.open({ database: ":memory:", entities: [note] })
  const repository = store.source.getRepository(note)
  await repository.save({ id: "n1", text: "dynamic" })
  expect(await repository.findOneBy({ id: "n1" })).toEqual({ id: "n1", text: "dynamic" })
  await store.close()
})
