/**
 * Mantis on effect-agent - mechanism tests:
 *   1. context economy: the model starts on the core surface only
 *   2. enable grows the visible surface (discoverable -> active)
 *   3. pending confirmation: a write hangs on the operator, then commits
 *   4. reflection is injected after a failed (not-active) tool step
 *   5. the session ends as a structured FinalReply (Until.schema)
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { Model, WireMessage, WireTool } from "@effect-agent/builtin"
import { makeMantis } from "../src/agent.ts"
import { gateApproval } from "../src/approval.ts"
import { ManualGate } from "@effect-agent/gate"

type Script = Array<{ text: string; toolCalls?: Array<{ id: string; name: string; input: unknown }> }>

const scriptedModel = (script: Script): Model & { calls: number; lastTools?: ReadonlyArray<WireTool>; lastThread?: ReadonlyArray<WireMessage> } => {
  const queue = [...script]
  const model: any = {
    calls: 0,
    generate: (_s: string, messages: ReadonlyArray<WireMessage>, tools: ReadonlyArray<WireTool>) => {
      model.calls++
      model.lastTools = tools
      model.lastThread = messages
      return Effect.succeed(queue.shift() ?? { text: "done", toolCalls: [] })
    }
  }
  return model
}

const names = (tools?: ReadonlyArray<WireTool>) => (tools ?? []).map((tool) => tool.name)
const finalJson = (reply: string, tone: "plain" | "emoji" = "plain", asksConfirmation = false) => ({
  text: JSON.stringify({ reply, tone, asksConfirmation }),
  toolCalls: [] as Array<never>
})

const waitFor = async (probe: () => Promise<boolean>, timeoutMs = 3000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await probe()) return
    await new Promise((resolve) => setTimeout(resolve, 15))
  }
  throw new Error("waitFor timed out")
}

describe("mantis: context economy (tool supply)", () => {
  test("the first model call sees the core surface only", async () => {
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t1", name: "tools_catalog", input: {} }] },
      finalJson("ready")
    ])
    const mantis = makeMantis({ model })
    const out = await Effect.runPromise(mantis.agent.run("hello"))
    expect(out.reply).toBe("ready")
    // the first call never saw the extended tools
    const firstSurface = model.lastTools
    expect(names(firstSurface)).toContain("tools_catalog")
    expect(names(firstSurface)).toContain("enable")
    expect(names(firstSurface)).toContain("recall_notes")
    expect(names(firstSurface)).not.toContain("note_write")
    expect(names(firstSurface)).not.toContain("set_reminder")
  })

  test("enable grows the surface for the next call", async () => {
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
      finalJson("enabled")
    ])
    const mantis = makeMantis({ model })
    const out = await Effect.runPromise(mantis.agent.run("give me note_write"))
    expect(out.reply).toBe("enabled")
    // after enable, the surface includes note_write
    expect(names(model.lastTools)).toContain("note_write")
  })
})

describe("mantis: protected calls wait for the operator", () => {
  // ONLY note_write is protected in this suite - other writes flow freely

  test("a protected write hangs until the operator approves, then commits", async () => {
    const gate = new ManualGate(() => true) // operator console: asks everything routed to it
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
      { text: "", toolCalls: [{ id: "t2", name: "note_write", input: { text: "ship v2 after review" } }] },
      finalJson("saved", "plain", false)
    ])
    const mantis = makeMantis({
      model,
      approvals: gateApproval(gate, (request) => request.tool === "note_write")
    })
    const run = Effect.runPromise(mantis.agent.run("note: ship v2 after review"))

    // the write sits on the operator console before it executes
    await waitFor(async () => (await Effect.runPromise(gate.listPending())).length === 1)
    expect(mantis.notes.search("ship v2")).toHaveLength(0) // not committed yet

    const pending = await Effect.runPromise(gate.listPending())
    await Effect.runPromise(gate.resolve(pending[0]!.callId, true))

    const out = await run
    expect(out.reply).toBe("saved")
    expect(mantis.notes.search("ship v2")).toHaveLength(1) // committed after approval
  })

  test("an operator denial fails the protected write as a recoverable tool error", async () => {
    const gate = new ManualGate(() => true) // operator console
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
      { text: "", toolCalls: [{ id: "t2", name: "note_write", input: { text: "delete everything" } }] },
      finalJson("noted the denial")
    ])
    const mantis = makeMantis({
      model,
      approvals: gateApproval(gate, (request) => request.tool === "note_write")
    })
    const run = Effect.runPromise(mantis.agent.run("note: delete everything"))

    await waitFor(async () => (await Effect.runPromise(gate.listPending())).length === 1)
    const pending = await Effect.runPromise(gate.listPending())
    await Effect.runPromise(gate.resolve(pending[0]!.callId, false))

    const out = await run
    expect(mantis.notes.search("delete everything")).toHaveLength(0) // never written
    expect(out.reply).toBe("noted the denial")
  })
})

describe("mantis: approvals are explicit, not implied by write", () => {
  test("writes execute without any approval by default", async () => {
    const gate = new ManualGate() // created but NOT wired into any policy
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
      { text: "", toolCalls: [{ id: "t2", name: "enable", input: { name: "set_reminder" } }] },
      { text: "", toolCalls: [{ id: "t3", name: "set_reminder", input: { text: "9am daily" } }] },
      { text: "", toolCalls: [{ id: "t4", name: "note_write", input: { text: "plain note" } }] },
      finalJson("all written")
    ])
    const mantis = makeMantis({
      model,
      // protects NOTHING: every write flows
      approvals: gateApproval(gate, () => false)
    })
    const out = await Effect.runPromise(mantis.agent.run("write some things"))
    expect(out.reply).toBe("all written")
    expect(mantis.notes.all()).toHaveLength(2) // reminder + note, both committed
    expect(await Effect.runPromise(gate.listPending())).toHaveLength(0) // nobody was asked
  })

  test("a policy protects exactly what it picks", async () => {
    const gate = new ManualGate(() => true) // operator console
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
      { text: "", toolCalls: [{ id: "t2", name: "enable", input: { name: "set_reminder" } }] },
      { text: "", toolCalls: [{ id: "t3", name: "set_reminder", input: { text: "quick reminder" } }] },
      { text: "", toolCalls: [{ id: "t4", name: "note_write", input: { text: "protected note v2" } }] },
      finalJson("done")
    ])
    const mantis = makeMantis({
      model,
      approvals: gateApproval(gate, (request) => request.tool === "note_write")
    })
    const run = Effect.runPromise(mantis.agent.run("remind and note"))
    // set_reminder ran (unprotected); note_write is waiting for the operator
    await waitFor(async () => (await Effect.runPromise(gate.listPending())).length === 1)
    expect(mantis.notes.search("quick reminder")).toHaveLength(1)
    expect(mantis.notes.search("protected note")).toHaveLength(0)
    const pending = await Effect.runPromise(gate.listPending())
    expect(pending[0]!.input.tool).toBe("note_write")
    await Effect.runPromise(gate.resolve(pending[0]!.callId, true))
    expect((await run).reply).toBe("done")
    expect(mantis.notes.search("protected note")).toHaveLength(1)
  })
})

describe("mantis: reflection", () => {
  test("a not-active tool call triggers a reflection prompt before the next call", async () => {
    const model = scriptedModel([
      // the model calls note_write before enabling it -> not-active tool error
      { text: "", toolCalls: [{ id: "t1", name: "note_write", input: { text: "x" } }] },
      finalJson("learned")
    ])
    const mantis = makeMantis({ model })
    const out = await Effect.runPromise(mantis.agent.run("hi"))
    expect(out.reply).toBe("learned")
    // a reflection prompt was injected into the thread
    const thread = model.lastThread ?? []
    const hasReflection = thread.some(
      (message) => message.role === "user" && message.content.includes("Reflect")
    )
    expect(hasReflection).toBe(true)
  })
})

describe("mantis: reply contract", () => {
  test("the session ends as a structured FinalReply", async () => {
    const model = scriptedModel([finalJson("all good", "emoji", true)])
    const mantis = makeMantis({ model })
    const out = await Effect.runPromise(mantis.agent.run("hi"))
    expect(out.reply).toBe("all good")
    expect(out.tone).toBe("emoji")
    expect(out.asksConfirmation).toBe(true)
  })
})
