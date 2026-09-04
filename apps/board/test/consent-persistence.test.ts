import { describe, expect, test } from "bun:test"
import { Effect, Ref } from "effect"
import { makeBoard } from "../src/board.ts"
import { unlinkSync } from "node:fs"

describe("board consent persistence", () => {
  test("consent requests survive a board restart", async () => {
    const file = `/tmp/board-consent-${Date.now()}.json`
    const first = await Effect.runPromise(makeBoard({ dataFile: file }))
    await Effect.runPromise(Ref.set(first.tables.consents, new Map([["ask-1", { askId: "ask-1", runId: "run-1", agentId: "probe", tool: "write", createdAt: 1 }]])))
    await Effect.runPromise(first.persist())
    const second = await Effect.runPromise(makeBoard({ dataFile: file }))
    const restored = await Effect.runPromise(Ref.get(second.tables.consents))
    expect(restored.get("ask-1")?.tool).toBe("write")
    unlinkSync(file)
  })
})
