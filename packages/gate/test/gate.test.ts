import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { AllowAllGate, DenyWritesGate, ManualGate } from "@effect-agent/gate"

describe("Gate", () => {
  it("AllowAllGate permits everything", async () => {
    const decision = await Effect.runPromise(AllowAllGate.decide({ tool: "x", input: {}, access: "write" }))
    expect(decision._tag).toBe("Allow")
  })

  it("DenyWritesGate blocks writes outside allowed sessions", async () => {
    const gate = DenyWritesGate(["trusted"])
    const denied = await Effect.runPromise(gate.decide({ tool: "fs.write", input: {}, access: "write", session: "other" }))
    expect(denied._tag).toBe("Deny")
    const allowed = await Effect.runPromise(gate.decide({ tool: "fs.read", input: {}, access: "read", session: "other" }))
    expect(allowed._tag).toBe("Allow")
  })

  it("ManualGate asks for writes and resolves via operator", async () => {
    const gate = new ManualGate()
    const first = await Effect.runPromise(gate.decide({ tool: "rm", input: { path: "/" }, access: "write", session: "s1" }))
    expect(first._tag).toBe("Ask")
    const pending = await Effect.runPromise(gate.listPending())
    expect(pending).toHaveLength(1)
    await Effect.runPromise(gate.resolve(pending[0]!.callId, true))
    const second = await Effect.runPromise(gate.decide({ tool: "rm", input: { path: "/" }, access: "write", session: "s1" }))
    expect(second._tag).toBe("Allow")
    expect(await Effect.runPromise(gate.listPending())).toHaveLength(0)
  })
})
