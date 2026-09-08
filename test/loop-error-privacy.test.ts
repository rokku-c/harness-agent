import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { AgentContext, Op, notationText, type AgentEvent } from "@effect-agent/core"
import { runOp } from "../packages/builtin/src/loop/execute.ts"
import { runTurnCalls, type TurnEnv } from "../packages/builtin/src/loop/turn.ts"
import type { RunBox } from "../packages/builtin/src/loop/types.ts"

const secret = "sk-model-private-input"

test("malformed final-tool feedback, events and budget-exhausted failures contain only field/type diagnostics", async () => {
  const box: RunBox = { context: AgentContext.text("go"), thread: [], usedTools: [], retries: 0 }
  const events: AgentEvent[] = []
  const env: TurnEnv = {
    driverId: "effect-agent", agentName: "test", byName: new Map(), visible: new Set(), decodeRetries: 1,
    finalTool: { name: "submit_reply", description: "Return a reply",
      schema: Schema.Struct({ reply: Schema.Number, apiKey: Schema.String }) },
    emit: (event) => Effect.sync(() => { events.push(event) }),
  }
  const call = { id: "bad", name: "submit_reply", input: { reply: secret, apiKey: secret } }
  const detail = "Invalid tool input: $.reply: expected number"
  const output = { error: "submit_reply error: " + detail }
  const first = await Effect.runPromise(runTurnCalls(env, box, [call]) as Effect.Effect<unknown>)
  expect(first).toEqual({ _tag: "Continue" })
  expect(box.retries).toBe(1)
  expect(box.lastToolError).toBe(detail)
  expect(box.thread).toEqual([{ role: "tool", id: "bad", name: "submit_reply", content: output.error }])
  expect(box.context.entries).toEqual([{ _tag: "Text", text: "go" },
    { _tag: "ToolResult", id: "bad", name: "submit_reply", output }])
  expect(events).toEqual([{ _tag: "ToolResult", agent: "test", tool: "submit_reply", output }])
  const failed = await Effect.runPromise(runTurnCalls(env, box, [call]).pipe(Effect.either) as Effect.Effect<
    import("effect").Either.Either<unknown, import("@effect-agent/core").AgentFailure>>)
  expect(failed._tag).toBe("Left")
  if (failed._tag === "Left") {
    expect(failed.left.cause).toBe(detail)
    expect(JSON.stringify(failed.left)).not.toContain(secret)
  }
  expect(box.retries).toBe(1)
  expect(events).toHaveLength(1)
})

test("ordinary tool argument decoding uses safe diagnostics without executing invalid input", async () => {
  let executed = false
  const op = Op.read({ name: "lookup", description: notationText("Look up an item"),
    input: Schema.Struct({ count: Schema.Number }), output: Schema.String,
    execute: () => { executed = true; return Effect.succeed("unused") } })
  const result = await Effect.runPromise(runOp(op, { count: secret }) as Effect.Effect<unknown>)
  expect(result).toEqual({ ok: false, detail: "Invalid tool input: $.count: expected number" })
  expect(executed).toBe(false)
})

test("ordinary tool business output and business failure details are not redacted or rewritten", async () => {
  const output = { apiKey: secret, reply: "business result" }
  const spec = { name: "lookup", description: notationText("Look up an item"),
    input: Schema.Struct({ count: Schema.Number }), output: Schema.Unknown }
  const op = Op.read({ ...spec, execute: () => Effect.succeed(output) })
  expect(await Effect.runPromise(runOp(op, { count: 1 }) as Effect.Effect<unknown>)).toEqual({ ok: true, output })
  const failing = Op.read({ ...spec, execute: () => Effect.fail({ cause: "item unavailable" }) })
  expect(await Effect.runPromise(runOp(failing, { count: 1 }) as Effect.Effect<unknown>))
    .toEqual({ ok: false, detail: "item unavailable" })
})
