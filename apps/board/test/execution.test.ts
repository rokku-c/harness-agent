import { describe, expect, test } from "bun:test"
import { canRetry, type LaunchIntent } from "../src/domain.ts"

describe("execution contract", () => {
  test("keeps launch independent from a concrete runner", () => {
    const intent: LaunchIntent = { nodeId: "n1", agentId: "probe", mode: "isolated", kind: "codex", isolation: "env", runPolicy: { merge: "review" } }
    expect(intent.mode).toBe("isolated")
    expect(intent.runPolicy?.merge).toBe("review")
  })
  test("only failed and orphan runs are retryable", () => {
    expect(canRetry("failed")).toBe(true)
    expect(canRetry("orphan")).toBe(true)
    expect(canRetry("done")).toBe(false)
  })
})
