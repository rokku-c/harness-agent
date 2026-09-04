/**
 * Resource governance through the real service: exclusive vs shared, atomic
 * multi-claims, priority/fifo wake of parked waiters, wait cancellation.
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { makeBoard, type BoardApi } from "../src/board.ts"

const fresh = () => Effect.runPromise(makeBoard({ dataFile: undefined }))

const create = async (board: BoardApi, input: Parameters<BoardApi["createItem"]>[0]): Promise<string> =>
  (await Effect.runPromise(board.createItem(input))).itemId
const start = async (board: BoardApi, itemId: string, executorId = "exec"): Promise<{ ok: boolean; state: string }> =>
  Effect.runPromise(board.start(itemId, executorId))
const done = async (board: BoardApi, itemId: string): Promise<{ ok: boolean }> =>
  Effect.runPromise(board.report(itemId, "done"))
const itemState = async (board: BoardApi, itemId: string): Promise<string | undefined> =>
  (await Effect.runPromise(board.getItem(itemId)))?.state

const RES = { resourceId: "ws-1", kind: "workspace" as const, name: "workspace one", capacity: 1, concurrency: "exclusive" as const }

describe("governor: exclusive resources", () => {
  test("first holder wins; the second waits; release auto-grants it", async () => {
    const board = await fresh()
    await Effect.runPromise(board.createResource(RES))
    const a = await create(board, { title: "A", requires: [{ resourceId: "ws-1" }] })
    const b = await create(board, { title: "B", requires: [{ resourceId: "ws-1" }] })
    expect((await start(board, a)).state).toBe("doing")
    const second = await start(board, b)
    expect(second.state).toBe("blocked")
    expect((await itemState(board, b))).toBe("blocked")
    // releasing A hands the workspace to parked B in the same effect
    await done(board, a)
    expect(await itemState(board, b)).toBe("doing")
  })

  test("an exclusive resource never has two holders", async () => {
    const board = await fresh()
    await Effect.runPromise(board.createResource(RES))
    const a = await create(board, { title: "A", requires: [{ resourceId: "ws-1" }] })
    const b = await create(board, { title: "B", requires: [{ resourceId: "ws-1" }] })
    await start(board, a)
    await start(board, b)
    const state = await Effect.runPromise(board.state())
    const ws = state.resources.find((r) => r.resourceId === "ws-1")
    expect(ws?.used).toBe(1) // never 2 despite both wanting it
  })
})

describe("governor: shared resources up to capacity", () => {
  test("two of three slots used together, third parks until release", async () => {
    const board = await fresh()
    await Effect.runPromise(board.createResource({ resourceId: "slots", kind: "slot", name: "slots", capacity: 2, concurrency: "shared" }))
    const a = await create(board, { title: "A", requires: [{ resourceId: "slots", amount: 1 }] })
    const b = await create(board, { title: "B", requires: [{ resourceId: "slots", amount: 1 }] })
    const c = await create(board, { title: "C", requires: [{ resourceId: "slots", amount: 1 }] })
    expect((await start(board, a)).state).toBe("doing")
    expect((await start(board, b)).state).toBe("doing")
    const third = await start(board, c)
    expect(third.state).toBe("blocked")
    await done(board, a)
    expect(await itemState(board, c)).toBe("doing")
  })
})

describe("governor: atomic all-or-nothing claim groups", () => {
  test("a competing claim group never grabs a partial slice", async () => {
    const board = await fresh()
    await Effect.runPromise(board.createResource({ resourceId: "wsA", kind: "workspace", name: "A", capacity: 1, concurrency: "exclusive" }))
    await Effect.runPromise(board.createResource({ resourceId: "wsB", kind: "workspace", name: "B", capacity: 1, concurrency: "exclusive" }))
    const big = await create(board, { title: "big", requires: [{ resourceId: "wsA" }, { resourceId: "wsB" }] })
    const waiter = await create(board, { title: "waiter", requires: [{ resourceId: "wsA" }, { resourceId: "wsB" }] })
    const solo = await create(board, { title: "solo", requires: [{ resourceId: "wsA" }] })
    await start(board, big)
    expect((await start(board, waiter)).state).toBe("blocked")
    expect((await start(board, solo)).state).toBe("blocked") // A is taken whole: no partial
    // once big finishes, waiter (parked first) gets the full group before solo
    await done(board, big)
    expect(await itemState(board, waiter)).toBe("doing")
    // solo is still parked until waiter releases A again
    const held = await Effect.runPromise(board.governor.holdings())
    expect(held.held.get("wsA")?.has(solo)).toBe(false)
  })
})

describe("governor: parked waiters are cancellable", () => {
  test("cancelling a parked waiter drops it from the wait queue", async () => {
    const board = await fresh()
    await Effect.runPromise(board.createResource(RES))
    const a = await create(board, { title: "A", requires: [{ resourceId: "ws-1" }] })
    const b = await create(board, { title: "B", requires: [{ resourceId: "ws-1" }] })
    await start(board, a)
    await start(board, b) // parked
    await Effect.runPromise(board.cancel(b))
    expect(await itemState(board, b)).toBe("cancelled")
    await done(board, a)
    // b must not flip to doing after cancel
    expect(await itemState(board, b)).toBe("cancelled")
  })
})
