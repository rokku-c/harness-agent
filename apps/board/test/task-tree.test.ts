import { describe, expect, test } from "bun:test"
import { assertParent, attachChild, rollup, unblockDependents, TreeInvariantError, type WorkItem } from "../src/domain.ts"

const item = (itemId: string, state: WorkItem["state"], kind: WorkItem["kind"] = "leaf", parentId?: string): WorkItem => ({
  itemId, title: itemId, state, kind, parentId, priority: "normal", dependencies: [], children: [], labels: [], createdAt: 0, updatedAt: 0
})

describe("task tree domain", () => {
  test("preserves child order and rejects cycles", () => {
    const root = item("root", "todo", "goal")
    const a = item("a", "ready", "leaf", "root")
    const b = item("b", "ready", "leaf", "root")
    const map = new Map([[root.itemId, root], [a.itemId, a], [b.itemId, b]])
    const first = attachChild(map, "root", "a")
    const next = new Map(map).set("root", first)
    const changed = attachChild(next, "root", "b")
    expect(changed.children).toEqual(["a", "b"])
    expect(() => assertParent(new Map([["a", item("a", "todo", "leaf", "b")], ["b", item("b", "todo", "group", "a")]]), item("x", "todo", "leaf", "a"))).toThrow(TreeInvariantError)
  })

  test("rolls up descendants using leaf states", () => {
    const root = item("g", "todo", "group")
    const a = item("a", "done", "leaf", "g")
    const b = item("b", "doing", "leaf", "g")
    const map = new Map([["g", { ...root, children: ["a", "b"] }], ["a", a], ["b", b]])
    expect(rollup(map, "g")).toEqual({ state: "doing", leaves: 2, doneLeaves: 1, progress: 0.5 })
  })

  test("unblocks dependency waiters when all dependencies finish", () => {
    const dep = item("dep", "done")
    const waiter = { ...item("waiter", "blocked"), dependencies: ["dep"], blockedReason: "dependencies" }
    const next = unblockDependents(new Map([["dep", dep], ["waiter", waiter]]), "dep")
    expect(next.get("waiter")?.state).toBe("ready")
  })
})
