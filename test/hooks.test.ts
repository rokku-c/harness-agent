import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { Context, Harness, Op, runDriver, Until, type Binding, type Driver } from "../src/index.js"

describe("HarnessHook", () => {
  test("observes framework lifecycle and instrumented Binding Ops", async () => {
    const events: string[] = []
    const hook = Harness.hook("capture", (event) => Effect.sync(() => events.push(event._tag)))
    const Echo = Op.read({
      name: "echo",
      description: "echo",
      input: Schema.Struct({ text: Schema.String }),
      output: Schema.String,
      execute: ({ text }) => Effect.succeed(text)
    })
    const binding: Binding = { uri: "ea://test/service/echo", ops: [Echo] }
    const driver: Driver = {
      id: "fake",
      capabilities: {
        provider: { _tag: "Configurable" }, granularity: "run", thinking: false,
        cancel: false, pause: false, resume: false, fork: "none",
        tools: "native", toolCalls: "observe", structuredOutput: "none", sandbox: "none", subagents: false
      },
      start: (request): any => Effect.succeed({
        step: request.context.access[0]!.binding.ops![0]!.execute({ text: "ok" }).pipe(
          Effect.map((value) => ({ _tag: "Result", value }))
        )
      })
    }

    const context = Context.with({ messages: [{ role: "user", content: "hello" }] }).withUntil(Until.stop).withAccess([{ binding, write: false }])
    const output = await Effect.runPromise(runDriver(Harness.withHooks(driver, hook), context))

    expect(output.output).toBe("ok")
    expect(events).toEqual([
      "RunStarted", "ToolStarted", "ToolCompleted", "Output", "RunCompleted"
    ])
  })
})
