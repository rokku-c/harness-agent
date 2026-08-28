import { describe, expect, test } from "bun:test"
import { AgentContext, type Content } from "../src/core.js"
import { fromSnapshot, snapshotContext } from "../src/context-snapshot.js"

describe("context snapshot", () => {
  test("round-trips all five Content kinds with deep equality", () => {
    const context = new AgentContext([
      { _tag: "Text", text: "hello" },
      { _tag: "Thinking", text: "plan" },
      { _tag: "ToolCall", id: "t1", name: "read", input: { path: "." } },
      { _tag: "ToolResult", id: "t1", name: "read", output: { ok: true } },
      { _tag: "Object", value: { nested: [1, 2, 3] } }
    ])
    const rebuilt = fromSnapshot(snapshotContext(context))
    expect(rebuilt.entries).toEqual(context.entries)
    expect(rebuilt).not.toBe(context)
  })

  test("projection is immutable: the snapshot array is a slice, not a view", () => {
    const context = AgentContext.text("x")
    const snapshot = snapshotContext(context)
    expect(snapshot.entries).not.toBe(context.entries)
    expect(snapshot.entries.length).toBe(1)
    // mutating the snapshot array must not touch the source context
    ;(snapshot.entries as Content[]).push({ _tag: "Text", text: "injected" })
    expect(context.entries.length).toBe(1)
  })

  test("snapshots survive a JSON round-trip", () => {
    const context = new AgentContext([
      { _tag: "Text", text: "hi" },
      { _tag: "ToolCall", id: "c1", name: "n", input: { a: 1 } }
    ])
    const snapshot = snapshotContext(context)
    const json = JSON.stringify(snapshot)
    const parsed = JSON.parse(json) as ReturnType<typeof snapshotContext>
    expect(fromSnapshot(parsed).entries).toEqual(context.entries)
  })

  test("an empty context round-trips to an equivalent empty context", () => {
    const snapshot = snapshotContext(AgentContext.empty)
    expect(snapshot).toEqual({ version: 1, entries: [] })
    expect(fromSnapshot(snapshot).entries).toEqual([])
  })
})
