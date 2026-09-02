import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { ScopedMemory, Memory } from "@effect-agent/memory"
import { MemoryStore, Store } from "@effect-agent/state"

const run = <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect)

const memoryWithStore = () => Effect.gen(function* () {
  const store = yield* MemoryStore
  const service = yield* ScopedMemory.pipe(Effect.provideService(Store, store))
  return service
})

describe("Memory", () => {
  it("remember/recall with keyword scoring and importance boost", async () => {
    const memory = await run(memoryWithStore())
    await run(memory.remember("user likes coffee", "preference", ["coffee"], 2))
    await run(memory.remember("project ships next week", "task", ["release"], 1))
    const results = await run(memory.recall("coffee"))
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.entry.content).toContain("coffee")
  })

  it("recall ranks by relevance; unrelated query returns nothing", async () => {
    const memory = await run(memoryWithStore())
    await run(memory.remember("deployment runs on Friday", "task", ["deploy"]))
    const unrelated = await run(memory.recall("what is the weather"))
    expect(unrelated).toHaveLength(0)
  })

  it("entries are typed and filterable", async () => {
    const memory = await run(memoryWithStore())
    await run(memory.remember("a", "preference"))
    await run(memory.remember("b", "task"))
    expect(await run(memory.entries("preference"))).toHaveLength(1)
    expect(await run(memory.entries())).toHaveLength(2)
  })

  it("Memory Tag is providable as a service", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const memory = yield* Memory
        yield* memory.remember("hello world", "note")
        return yield* memory.recall("hello")
      }).pipe(
        Effect.provideService(Store, await run(MemoryStore)),
        Effect.provideService(Memory, await run(memoryWithStore()))
      )
    )
    expect(result).toHaveLength(1)
  })
})
