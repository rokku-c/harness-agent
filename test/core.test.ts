import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  Agent, AgentContext, Container, Harness, ConsoleHook, Op, Until,
  memoryNotationStore, materialize, notationText, requireUntil, resolveNotation,
  type Binding, type Driver, type RunRequest, type Capabilities, UnsupportedCapability
} from "@effect-agent/core"

const caps: Capabilities = {
  provider: { _tag: "Configurable" }, granularity: "run", thinking: false, cancel: true,
  pause: true, resume: false, fork: "none", tools: "native", toolCalls: "intercept",
  structuredOutput: "text", sandbox: "none"
}

const scriptedDriver = (outputs: unknown[]): Driver => ({
  id: "scripted",
  capabilities: caps,
  run: <A, R>(request: RunRequest<A, R>) =>
    Effect.gen(function* () {
      const prepared = yield* materialize(request)
      return outputs.shift() as A
    }) as any
})

const store = () => memoryNotationStore([
  { target: "op/lookup", instructions: ["Look up the current weather for {city}."] }
])

describe("agent algebra", () => {
  test("define -> returns -> implementedBy expresses the sentence", async () => {
    const driver = scriptedDriver(["done"])
    const agent = Agent
      .define("ops-lead", (task: string) => AgentContext.text("Task: " + task))
      .returns(Until.text)
      .implementedBy(driver)
    expect(agent.id).toBe("ops-lead")
    const output = await Effect.runPromise(agent.run("ship it"))
    expect(output).toBe("done")
  })

  test("uses/writes accumulate access; the driver receives it", async () => {
    const readBinding: Binding = { uri: "ea://mem/notes/main", read: Effect.succeed({ _tag: "Text" as const, text: "notes content" }) }
    const opsBinding: Binding = {
      uri: "ea://svc/weather/main",
      ops: [Op.read({
        name: "lookup",
        description: notationText("Look up weather."),
        input: Schema.Struct({ city: Schema.String }),
        output: Schema.Struct({ temp: Schema.Number }),
        execute: ({ city }) => Effect.succeed({ temp: 24 })
      })]
    }
    let seen: RunRequest<any, any> | undefined
    const driver: Driver = {
      id: "spy",
      capabilities: caps,
      run: <A, R>(request: RunRequest<A, R>) => Effect.sync(() => {
        seen = request
        return "ok" as A
      })
    }
    const agent = Agent
      .define("reviewer", (topic: string) => AgentContext.text("Review " + topic))
      .returns(Until.text)
      .uses(readBinding)
      .writes(opsBinding)
      .implementedBy(driver)
    await Effect.runPromise(agent.run("the loop"))
    expect(seen?.access).toHaveLength(2)
    expect(seen?.access[0]?.write).toBe(false)
    expect(seen?.access[1]?.write).toBe(true)
  })

  test("materialize pulls readable bindings into the context", async () => {
    const binding = { uri: "ea://mem/notes/main", read: Effect.succeed({ _tag: "Text" as const, text: "the note" }) }
    const prepared = await Effect.runPromise(materialize({
      context: AgentContext.text("hello"),
      until: Until.text,
      access: [{ binding, write: false }]
    }))
    expect(prepared.context.entries).toHaveLength(2)
    expect(prepared.context.entries[1]).toEqual({ _tag: "Text", text: "the note" })
  })

  test("requireUntil rejects unsupported untils with precise reasons", () => {
    const thinking = requireUntil("a", { ...caps, thinking: false }, Until.thinking)
    expect(thinking instanceof UnsupportedCapability).toBe(true)
    const toolCall = requireUntil("a", { ...caps, toolCalls: "observe" }, Until.toolCall)
    expect(toolCall instanceof UnsupportedCapability).toBe(true)
    const text = requireUntil("a", caps, Until.text)
    expect(text).toBeUndefined()
  })

  test("Op.read/Op.write declare access; notation resolves the prose", () => {
    const op = Op.read({
      name: "lookup",
      description: resolveNotation(store(), "op/lookup", { city: "Shanghai" }),
      input: Schema.Struct({ city: Schema.String }),
      output: Schema.Struct({ temp: Schema.Number }),
      execute: ({ city }) => Effect.succeed({ temp: 24 })
    })
    expect(op.access).toBe("read")
    expect(op.description).toContain("Shanghai")
    expect(() => resolveNotation(store(), "op/missing")).toThrow(/unresolved target/)
  })

  test("Harness.withHooks observes the whole run", async () => {
    const events: string[] = []
    const hook = Harness.hook("rec", (event) => Effect.sync(() => { events.push(event._tag) }))
    const opsBinding: Binding = {
      uri: "ea://svc/math/main",
      ops: [Op.read({
        name: "double",
        description: notationText("Doubles a number."),
        input: Schema.Struct({ n: Schema.Number }),
        output: Schema.Struct({ value: Schema.Number }),
        execute: ({ n }) => Effect.succeed({ value: n * 2 })
      })]
    }
    const driver: Driver = {
      id: "looped",
      capabilities: caps,
      run: <A, R>(request: RunRequest<A, R>) =>
        Effect.gen(function* () {
          const prepared = yield* materialize(request)
          const op = prepared.access[0]?.binding.ops?.[0]
          yield* op?.execute({ n: 2 }) ?? Effect.void
          return "end" as A
        }) as any
    }
    const observed = Harness.withHooks(driver, hook)
    const output = await Effect.runPromise(observed.run({
      context: AgentContext.text("go"),
      until: Until.text,
      access: [{ binding: opsBinding, write: false }]
    }))
    expect(output).toBe("end")
    expect(events).toContain("RunStarted")
    expect(events).toContain("ToolStarted")
    expect(events).toContain("ToolCompleted")
    expect(events).toContain("Output")
    expect(events).toContain("RunCompleted")
  })

  test("a failing hook fails as an AgentFailure attributed to the hook", async () => {
    const hook = Harness.hook("bad", () => Effect.fail("hook blew up"))
    const driver: Driver = {
      id: "x",
      capabilities: caps,
      run: <A, R>(request: RunRequest<A, R>) => Effect.succeed("ok" as A)
    }
    const request: RunRequest<string> = { context: AgentContext.empty, until: Until.text, access: [] }
    const failed = await Effect.runPromise(
      Harness.withHooks(driver, hook).run(request).pipe(Effect.either)
    )
    expect(failed._tag).toBe("Left")
    if (failed._tag === "Left") {
      const failure = failed.left as { agent?: string; message?: string }
      expect(failure.agent).toBe("hook:bad")
      expect(failure.message).toContain("bad")
    }
  })

  test("Uri.make renders the ea:// scheme and Container resolves by uri", () => {
    expect(Uri_free()).toBe("ea://mem/note/main")
    const binding = { uri: "ea://mem/note/main", read: Effect.succeed({ _tag: "Text" as const, text: "n" }) }
    const container = new Container([binding])
    expect(container.get("ea://mem/note/main")).toBeDefined()
    expect(container.get("ea://mem/note/other")).toBeUndefined()
  })
})

function Uri_free() {
  const { Uri } = require("@effect-agent/core")
  return Uri.make("mem", "note", "main")
}

