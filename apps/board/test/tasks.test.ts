import { expect, test } from "bun:test"
import { makeBoard } from "../src/board.ts"

test("task CRUD records the resulting data and ordered events", () => {
  const board = makeBoard()
  try {
    const task = board.create({ title: "first" })
    expect(task.state).toBe("todo")
    expect(task.dependsOn).toEqual([])
    expect(board.update(task.id, { state: "done", body: "result" })).toMatchObject({ state: "done", body: "result" })
    expect(board.state().counts.done).toBe(1)
    expect(board.events().map((e) => e.kind)).toEqual(["task.created", "task.updated"])
    expect(board.delete(task.id)).toEqual({ ok: true })
    expect(board.list()).toEqual([])
    expect(board.events(2).map((e) => e.kind)).toEqual(["task.deleted"])
    expect(() => board.get(task.id)).toThrow("Task not found")
  } finally { board.close() }
})
test("hierarchy/dependency validation protects data without scheduling any work", () => {
  const board = makeBoard()
  try {
    const parent = board.create({ title: "parent" })
    const child = board.create({ title: "child", parentId: parent.id, dependsOn: [parent.id] })
    expect(board.tree().roots[0].children[0].id).toBe(child.id)
    expect(() => board.update(parent.id, { parentId: child.id })).toThrow("cycle")
    expect(() => board.update(parent.id, { dependsOn: [child.id] })).toThrow("cycle")
    expect(() => board.create({ title: "bad", dependsOn: ["missing"] })).toThrow("does not exist")
    expect(() => board.delete(parent.id)).toThrow("references")
    expect(board.events()).toHaveLength(2)
    board.update(child.id, { parentId: null, dependsOn: [] })
    board.delete(parent.id)
    expect(board.tree().roots.map((t) => t.id)).toEqual([child.id])
    expect(board.get(child.id).state).toBe("todo")
  } finally { board.close() }
})
