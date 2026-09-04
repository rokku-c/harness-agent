/**
 * Gate: the approval seam.
 *   - the default asks NOTHING: writes flow unless a policy protects them
 *   - askWhen-protected calls Ask, and request() waits for the operator
 *     (Deferred wake, no polling); resolve answers, timeout denies
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { AllowAllGate, DenyWritesGate, ManualGate } from "../src/gate.ts"

const writeIn = { tool: "note_write", input: { text: "hello" }, access: "write" as const, session: "s1" }
const protectWrites = () => new ManualGate((input) => input.access === "write")

const run = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runPromise(effect)

describe("gate: default is open", () => {
  test("ManualGate asks nothing by default - writes flow", async () => {
    const gate = new ManualGate()
    const decision = await run(gate.decide(writeIn))
    expect(decision._tag).toBe("Allow")
    expect(await run(gate.listPending())).toHaveLength(0)
  })

  test("AllowAllGate always allows", async () => {
    expect((await run(AllowAllGate.decide(writeIn)))._tag).toBe("Allow")
    expect((await run(AllowAllGate.request(writeIn)))._tag).toBe("Allow")
  })

  test("DenyWritesGate denies protected writes, allows the rest", async () => {
    const gate = DenyWritesGate([])
    const denied = await run(gate.request(writeIn))
    expect(denied._tag).toBe("Deny")
    const readOk = await run(gate.request({ ...writeIn, access: "read" }))
    expect(readOk._tag).toBe("Allow")
  })
})

describe("gate: protected calls wait for the operator", () => {
  test("askWhen-protected write Asks, request waits, resolve(true) allows", async () => {
    const gate = protectWrites()
    const pending = run(gate.request(writeIn, 5_000)) // starts and hangs
    // one tick later the call sits on the operator console
    await new Promise((resolve) => setTimeout(resolve, 10))
    const queue = await run(gate.listPending())
    expect(queue).toHaveLength(1)
    expect(queue[0]!.input.tool).toBe("note_write")
    // operator approves
    await run(gate.resolve(queue[0]!.callId, true))
    expect((await pending)._tag).toBe("Allow")
  })

  test("resolve(false) denies the waiting call", async () => {
    const gate = protectWrites()
    const pending = run(gate.request(writeIn, 5_000))
    await new Promise((resolve) => setTimeout(resolve, 10))
    const queue = await run(gate.listPending())
    await run(gate.resolve(queue[0]!.callId, false))
    expect((await pending)._tag).toBe("Deny")
  })

  test("an unanswered Ask times out into Deny", async () => {
    const gate = protectWrites()
    const verdict = await run(gate.request(writeIn, 50))
    expect(verdict._tag).toBe("Deny")
    // the timed-out entry left the console
    expect(await run(gate.listPending())).toHaveLength(0)
  })

  test("resolving an unknown call fails", async () => {
    const gate = protectWrites()
    const result = await Effect.runPromise(
      gate.resolve("nope", true).pipe(Effect.either)
    )
    expect(result._tag).toBe("Left")
  })

  test("a resolved verdict is remembered for later identical calls", async () => {
    const gate = protectWrites()
    const pending = run(gate.request(writeIn, 5_000))
    await new Promise((resolve) => setTimeout(resolve, 10))
    const queue = await run(gate.listPending())
    await run(gate.resolve(queue[0]!.callId, true))
    await pending
    // the same call again: decided from memory, no Ask
    const again = await run(gate.request(writeIn, 100))
    expect(again._tag).toBe("Allow")
    expect(await run(gate.listPending())).toHaveLength(0)
  })
})
