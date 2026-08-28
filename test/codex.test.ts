import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { Agent, AgentContext, AgentFailure, CodexAgent, Until } from "../src/index.js"

describe("codex failure branches", () => {
  test("a thread.run rejection fails the run as AgentFailure keeping the cause", async () => {
    const boom = new Error("codex api down")
    const client = { startThread: () => ({ run: async () => { throw boom } }) } as any
    const driver = CodexAgent.make({ client })
    const program = Agent.define<string>("s", (s) => AgentContext.text(s)).returns(Until.stop).implementedBy(driver)
    const failure = await Effect.runPromise(Effect.flip(program.run("hello")))
    expect(failure).toBeInstanceOf(AgentFailure)
    const err = failure as AgentFailure
    expect(err.agent).toBe("codex")
    expect(err.cause).toBe(boom)
  })

  test("a non-JSON finalResponse fails the run as AgentFailure", async () => {
    const client = { startThread: () => ({ run: async () => ({ sessionId: "s", finalResponse: "not json" }) }) } as any
    const driver = CodexAgent.make({ client })
    const program = Agent.define<string>("s", (s) => AgentContext.text(s))
      .returns(Until.schema(Schema.Struct({ ok: Schema.Boolean })))
      .implementedBy(driver)
    const failure = await Effect.runPromise(Effect.flip(program.run("hello")))
    expect(failure).toBeInstanceOf(AgentFailure)
    expect((failure as AgentFailure).cause).toBeInstanceOf(SyntaxError)
  })

  test("a schema-invalid JSON finalResponse fails the run as AgentFailure", async () => {
    const client = { startThread: () => ({ run: async () => ({ sessionId: "s", finalResponse: "{\"ok\": \"yes\"}" }) }) } as any
    const driver = CodexAgent.make({ client })
    const program = Agent.define<string>("s", (s) => AgentContext.text(s))
      .returns(Until.schema(Schema.Struct({ ok: Schema.Boolean })))
      .implementedBy(driver)
    const failure = await Effect.runPromise(Effect.flip(program.run("hello")))
    expect(failure).toBeInstanceOf(AgentFailure)
    expect((failure as AgentFailure).agent).toBe("schema")
  })

  test("the text path returns the final response text", async () => {
    const client = { startThread: () => ({ run: async () => ({ sessionId: "s", finalResponse: "hello back" }) }) } as any
    const driver = CodexAgent.make({ client })
    const program = Agent.define<string>("s", (s) => AgentContext.text(s)).returns(Until.stop).implementedBy(driver)
    const output = await Effect.runPromise(program.run("hello"))
    expect(output).toBe("hello back")
  })

  test("binding.ops fail loud instead of silently dropping the tools", async () => {
    const client = { startThread: () => ({ run: async () => ({ sessionId: "s", finalResponse: "ok" }) }) } as any
    const driver = CodexAgent.make({ client })
    const binding: import("../src/core.js").Binding<string, never, never> = {
      uri: "example://tool",
      ops: [{
        name: "f",
        description: "a tool",
        input: Schema.Struct({}),
        output: Schema.String,
        access: "read" as const,
        execute: () => Effect.succeed("ok")
      }]
    }
    const program = Agent.define<string>("s", (s) => AgentContext.text(s))
      .returns(Until.stop)
      .uses(binding)
      .implementedBy(driver)
    const failure = await Effect.runPromise(Effect.flip(program.run("hello")))
    expect(failure).toBeInstanceOf(AgentFailure)
    expect(String((failure as AgentFailure).cause)).toContain("not wired by the codex driver")
  })
})
