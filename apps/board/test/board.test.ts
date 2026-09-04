/**
 * Workflow rules + persistence through BoardApi (layer ② scheduler).
 */
import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { makeBoard, type BoardApi } from "../src/board.ts"

const fresh = () => Effect.runPromise(makeBoard({ dataFile: undefined }))
const create = async (board: BoardApi, title: string, extra: Record<string, unknown> = {}): Promise<string> =>
  (await Effect.runPromise(board.createItem({ title, ...extra } as never))).itemId
const stateOf = async (board: BoardApi, itemId: string) => (await Effect.runPromise(board.getItem(itemId)))?.state

describe("board: workflow rules", () => {
  test("dependencies gate a start until the dependency is done", async () => {
    const board = await fresh()
    const parent = await create(board, "parent")
    const child = await create(board, "child", { dependencies: [parent] })
    const early = await Effect.runPromise(board.start(child, "e1"))
    expect(early.state).toBe("blocked")
    expect(early.detail).toContain("dependencies")
    // unblock (operator), dependency still not done -> start re-blocks on deps
    await Effect.runPromise(board.unblock(child))
    const again = await Effect.runPromise(board.start(child, "e1"))
    expect(again.state).toBe("blocked")
    // parent finishes, child can run
    await Effect.runPromise(board.start(parent, "e1"))
    await Effect.runPromise(board.report(parent, "done"))
    await Effect.runPromise(board.unblock(child))
    expect((await Effect.runPromise(board.start(child, "e1"))).state).toBe("doing")
  })

  test("report only from doing; a second report is rejected", async () => {
    const board = await fresh()
    const id = await create(board, "item")
    const neverStarted = await Effect.runPromise(board.report(id, "done"))
    expect(neverStarted.ok).toBe(false)
    await Effect.runPromise(board.start(id, "e1"))
    expect((await Effect.runPromise(board.report(id, "done", "finished"))).ok).toBe(true)
    const second = await Effect.runPromise(board.report(id, "done"))
    expect(second.ok).toBe(false)
    expect((await Effect.runPromise(board.getItem(id)))?.result).toBe("finished")
  })

  test("failed releases claims like done does", async () => {
    const board = await fresh()
    await Effect.runPromise(board.createResource({ resourceId: "ws", kind: "workspace", name: "ws", capacity: 1, concurrency: "exclusive" }))
    const a = await create(board, "A", { requires: [{ resourceId: "ws" }] })
    const b = await create(board, "B", { requires: [{ resourceId: "ws" }] })
    await Effect.runPromise(board.start(a, "e1"))
    await Effect.runPromise(board.start(b, "e1"))
    await Effect.runPromise(board.report(a, "failed", "boom"))
    expect(await stateOf(board, b)).toBe("doing")
  })

  test("blocking releases claims; unblock puts the item back to ready", async () => {
    const board = await fresh()
    await Effect.runPromise(board.createResource({ resourceId: "ws", kind: "workspace", name: "ws", capacity: 1, concurrency: "exclusive" }))
    const a = await create(board, "A", { requires: [{ resourceId: "ws" }] })
    const b = await create(board, "B", { requires: [{ resourceId: "ws" }] })
    await Effect.runPromise(board.start(a, "e1"))
    await Effect.runPromise(board.start(b, "e1"))
    await Effect.runPromise(board.block(a, "human decision"))
    expect(await stateOf(board, b)).toBe("doing")
    await Effect.runPromise(board.unblock(a))
    expect(await stateOf(board, a)).toBe("ready")
  })

  test("children recorded on the parent; view columns group states", async () => {
    const board = await fresh()
    const parent = await create(board, "goal")
    const c1 = await create(board, "sub 1", { parentId: parent })
    const c2 = await create(board, "sub 2", { parentId: parent })
    const parentAfter = await Effect.runPromise(board.getItem(parent))
    expect(parentAfter?.children).toEqual([c1, c2])
    const view = await Effect.runPromise(board.viewItems())
    const todo = (view.view as { columns: Array<{ id: string; itemIds: string[] }> }).columns.find((c) => c.id === "todo")
    expect(todo?.itemIds).toEqual([parent, c1, c2])
  })
})

describe("board: persistence snapshot", () => {
  test("a data file survives a restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "board-test-"))
    const file = join(dir, "board.json")
    let board = await Effect.runPromise(makeBoard({ dataFile: file }))
    await Effect.runPromise(board.createResource({ resourceId: "ws", kind: "workspace", name: "ws", capacity: 1, concurrency: "exclusive" }))
    const goal = await create(board, "persisted goal")
    await Effect.runPromise(board.start(goal, "e1"))
    await Effect.runPromise(board.report(goal, "done", "restart safe"))
    expect(existsSync(file)).toBe(true)
    // new process instance over the same file sees the same state
    board = await Effect.runPromise(makeBoard({ dataFile: file }))
    const item = await Effect.runPromise(board.getItem(goal))
    expect(item?.state).toBe("done")
    expect(item?.result).toBe("restart safe")
    const resources = await Effect.runPromise(board.state())
    expect(resources.resources.length).toBe(1)
    rmSync(dir, { recursive: true, force: true })
  })
})
