import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { EventLog, MemoryEventLog, JsonlStore, MemoryStore, StoreBackedCheckpointStore } from "@effect-agent/state"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const run = <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect)

describe("Store", () => {
  it("MemoryStore get/put/query/transaction", async () => {
    const store = await run(MemoryStore)
    await run(store.put("a", { type: "note", text: "hello" }))
    await run(store.put("b", { type: "note", text: "world" }))
    expect(await run(store.get("a"))).toEqual({ type: "note", text: "hello" })
    expect(await run(store.query({ type: "note" }))).toHaveLength(2)
    expect(await run(store.query({ type: "checkpoint" }))).toHaveLength(0)
  })

  it("JsonlStore persists and reloads from disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "effect-agent-"))
    const path = join(dir, "store.jsonl")
    const first = new JsonlStore(path)
    await run(first.put("k", { type: "memo", text: "persisted" }))
    const second = new JsonlStore(path)
    expect(await run(second.get("k"))).toEqual({ type: "memo", text: "persisted" })
    expect(await run(second.query({ type: "memo" }))).toHaveLength(1)
  })
})

describe("EventLog", () => {
  it("append/stream with monotonic seq and session scoping", async () => {
    const log = await run(MemoryEventLog)
    await run(log.append("s1", "user.message", { text: "hi" }))
    await run(log.append("s1", "tool.completed", { tool: "x" }))
    await run(log.append("s2", "user.message", { text: "other" }))
    const s1 = await run(log.stream("s1"))
    expect(s1.map((e) => e.type)).toEqual(["user.message", "tool.completed"])
    expect(s1[0]!.seq).toBe(1)
    expect(s1[1]!.seq).toBe(2)
    const after = await run(log.stream("s1", 1))
    expect(after.map((e) => e.type)).toEqual(["tool.completed"])
    expect((await run(log.all()))).toHaveLength(3)
  })
})

describe("StoreBackedCheckpointStore", () => {
  it("put/get/list through the core protocol", async () => {
    const store = await run(MemoryStore)
    const checkpoints = StoreBackedCheckpointStore(store)
    await run(
      checkpoints.put({
        ref: { runId: "r1" },
        agent: "demo",
        task: "task",
        sensitivities: [{ _tag: "TimeSensitive" }],
        savedAt: 1000,
        payload: { step: 2 }
      })
    )
    const loaded = await run(checkpoints.get({ runId: "r1" }))
    expect(loaded?.agent).toBe("demo")
    expect(loaded?.payload).toEqual({ step: 2 })
    expect((await run(checkpoints.list()))).toHaveLength(1)
  })
})
