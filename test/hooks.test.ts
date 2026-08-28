import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { AgentContext, Harness, Op, Until, type Binding, type Driver } from "../src/index.js"
import { fixtureNotation } from "./fixture-notation.js"

const nl = fixtureNotation([{ target: "ops/echo", instructions: ["echo"] }])

describe("HarnessHook", () => {
  test("observes framework lifecycle and instrumented Binding Ops", async () => {
    const events: string[] = []
    const hook = Harness.hook("capture", (event) => Effect.sync(() => events.push(event._tag)))
    const Echo = Op.read({
      name: "echo",
      description: nl("ops/echo"),
      input: Schema.Struct({ text: Schema.String }),
      output: Schema.String,
      execute: ({ text }) => Effect.succeed(text)
    })
    const binding: Binding<any> = { uri: "ea://test/service/echo", ops: [Echo] }
    const driver: Driver = {
      id: "fake",
      capabilities: {
        provider: { _tag: "Configurable" }, granularity: "run", thinking: false,
        cancel: false, pause: false, resume: false, fork: "none",
        tools: "native", toolCalls: "observe", structuredOutput: "none", sandbox: "none"
      },
      run: (request) => request.access[0]!.binding.ops![0]!.execute({ text: "ok" }) as any
    }

    const output = await Effect.runPromise(Harness.withHooks(driver, hook).run({
      context: AgentContext.raw("hello"), until: Until.stop, access: [{ binding, write: false }]
    }))

    expect(output).toBe("ok")
    expect(events).toEqual([
      "RunStarted", "ToolStarted", "ToolCompleted", "Output", "RunCompleted"
    ])
  })
})
