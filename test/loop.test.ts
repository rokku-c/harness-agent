import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { Agent, AgentContext, Op, Until, notationText } from "@effect-agent/core"
import { EffectAgent, type Model, type WireMessage } from "@effect-agent/builtin"

import { weatherOp, scriptedModel, runAgent } from "./loop-fixture.ts"

describe("EffectAgent: the default loop", () => {
  test("Until.text: returns the first text", async () => {
    const model = scriptedModel([{ text: "sunny" }])
    const output = await Effect.runPromise(runAgent(model, Until.text))
    expect(output).toBe("sunny")
    expect(model.calls).toBe(1)
  })

  test("tool call first: the loop executes the op and continues", async () => {
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t1", name: "lookup", input: { city: "Shanghai" } }] },
      { text: "24 degrees in Shanghai" }
    ])
    const binding = { uri: "ea://svc/weather/main", ops: [weatherOp()] }
    const output = await Effect.runPromise(runAgent(model, Until.text, [{ binding, write: false }]))
    expect(output).toBe("24 degrees in Shanghai")
    expect(model.calls).toBe(2)
  })

  test("tool results land in the thread as tool messages", async () => {
    const seen: Array<ReadonlyArray<WireMessage>> = []
    const model: Model = {
      generate: (_s, messages) => {
        seen.push(messages)
        return seen.length === 1
          ? Effect.succeed({ text: "", toolCalls: [{ id: "t1", name: "lookup", input: { city: "Shanghai" } }] })
          : Effect.succeed({ text: "ok", toolCalls: [] })
      }
    }
    const binding = { uri: "ea://svc/weather/main", ops: [weatherOp()] }
    await Effect.runPromise(runAgent(model, Until.text, [{ binding, write: false }]))
    const toolMessage = seen[1]?.find((m) => m.role === "tool")
    expect(toolMessage).toBeDefined()
    expect(JSON.parse((toolMessage as any).content).temp).toBe(24)
  })

  test("Until.toolCall: intercepts the call WITHOUT executing it", async () => {
    let executed = false
    const op = Op.read({
      name: "lookup",
      description: notationText("Look up weather."),
      input: Schema.Struct({ city: Schema.String }),
      output: Schema.Struct({ temp: Schema.Number }),
      execute: () => {
        executed = true
        return Effect.succeed({ temp: 24 })
      }
    })
    const model = scriptedModel([{ text: "", toolCalls: [{ id: "t9", name: "lookup", input: { city: "X" } }] }])
    const binding = { uri: "ea://svc/weather/main", ops: [op] }
    const output = await Effect.runPromise(runAgent(model, Until.toolCall, [{ binding, write: false }]))
    expect(output._tag).toBe("ToolCall")
    expect(output.name).toBe("lookup")
    expect(executed).toBe(false)
  })

  test("unknown op is a recoverable tool error fed back to the model", async () => {
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t", name: "nope", input: {} }] },
      { text: "recovered" }
    ])
    const result = await Effect.runPromise(runAgent(model, Until.text))
    expect(result).toBe("recovered")
    const last = model.lastThread?.[model.lastThread.length - 1]
    expect(last?.role === "tool" && last.content.includes("unknown tool nope")).toBe(true)
  })

  test("maxSteps bounds the loop", async () => {
    const model: Model = {
      generate: () => Effect.succeed({ text: "", toolCalls: [{ id: "t", name: "lookup", input: { city: "X" } }] })
    }
    const binding: import("@effect-agent/core").Binding = { uri: "ea://svc/weather/main", ops: [weatherOp()] }
    const driver = EffectAgent.make({ model, maxSteps: 3 })
    const failed = await Effect.runPromise(
      driver.run({ context: AgentContext.text("w"), until: Until.text, access: [{ binding, write: false }] })
        .pipe(Effect.either)
    )
    expect(failed._tag).toBe("Left")
    if (failed._tag === "Left") expect((failed.left as { cause?: string }).cause).toContain("3 steps")
  })

  test("Agent.returns(Until.text).implementedBy(EffectAgent) runs end to end", async () => {
    const model = scriptedModel([{ text: "all clear" }])
    const agent = Agent
      .define("ops-lead", (task: string) => AgentContext.text("Handle: " + task))
      .returns(Until.text)
      .implementedBy(EffectAgent.make({ model }))
    const output = await Effect.runPromise(agent.run("incident on prod"))
    expect(output).toBe("all clear")
  })
})

