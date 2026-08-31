import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import {
  Agent, architect, any, bind, connection, inject, layer, named,
  memoryNotationStore, openaiProvider, type ArchitectureInput, type Connection, type GenerateResult, type AgentShape
} from "../src/index.ts"

const weather = connection("weather", [{
  name: "lookup",
  input: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
  output: { type: "object" },
  execute: () => Effect.succeed({ city: "Shanghai", temperature: 24 })
}])

const scriptOf = (...script: GenerateResult[]): Connection => {
  const queue = [...script]
  return {
    name: "scripted",
    tools: [],
    generate: () => {
      const next = queue.shift()
      return Effect.succeed(next ?? { text: "done", toolCalls: [] })
    }
  }
}

const store = () => memoryNotationStore([
  { target: "ops-lead/prompt", instructions: ["You are the operations lead. Route weather questions to your tools."] },
  { target: "reviewer/prompt", instructions: ["You review things carefully."] }
])

describe("agent architecture", () => {
  test("architect is inert: pure data, no prompt resolution, no tool binding", () => {
    const arch = architect({ name: "ops-lead", connections: { sky: named("weather") }, prompt: "ops-lead/prompt" })
    // the blueprint is data: the prompt is a TARGET, connections are DECLARATIONS
    expect(arch.prompt).toBe("ops-lead/prompt")
    expect(arch.connections.sky._tag).toBe("Named")
  })

  test("inject turns the architecture into an executable agent via notation", async () => {
    const arch = architect({ name: "ops-lead", connections: { sky: named("weather") }, prompt: "ops-lead/prompt" })
    const agent = await Effect.runPromise(inject(arch, {
      notation: store(),
      model: scriptOf({ text: "ready.", toolCalls: [] }),
      connections: [weather]
    }))
    // the executable agent is live: invoke it and read the log back
    const reply = await Effect.runPromise(agent.invokeMessage("status?"))
    expect(reply).toBe("ready.")
    const messages = await Effect.runPromise(agent.listMessages)
    expect(messages[0]?.role).toBe("user")
    expect(messages[1]?.role).toBe("assistant")
  })

  test("inject fails loud when the model is not a provider connection", async () => {
    const arch = architect({ name: "ops-lead", connections: { sky: named("weather") }, prompt: "ops-lead/prompt" })
    const failed = await Effect.runPromise(inject(arch, {
      notation: store(),
      model: weather,
      connections: [weather]
    }).pipe(Effect.map(() => null), Effect.either))
    expect(failed._tag).toBe("Left")
    if (failed._tag === "Left") expect((failed.left as { _tag: string })._tag).toBe("NotProvider")
  })

  test("inject fails loud when the notation target is missing (no prose, no agent)", async () => {
    const arch = architect({ name: "ops-lead", connections: { sky: named("weather") }, prompt: "missing/target" })
    const failed = await Effect.runPromise(inject(arch, {
      notation: store(),
      model: scriptOf(),
      connections: [weather]
    }).pipe(Effect.map(() => null), Effect.either))
    expect(failed._tag).toBe("Left")
    if (failed._tag === "Left") expect((failed.left as { _tag: string })._tag).toBe("PromptUnresolved")
  })

  test("the model loop runs through the provider connection", async () => {
    const arch = architect({ name: "ops-lead", connections: { sky: named("weather") }, prompt: "ops-lead/prompt" })
    const agent = await Effect.runPromise(inject(arch, {
      notation: store(),
      model: scriptOf(
        { text: "", toolCalls: [{ id: "t1", name: "weather__lookup", input: { city: "Shanghai" } }] },
        { text: "Shanghai is 24C.", toolCalls: [] }
      ),
      connections: [weather]
    }))
    const reply = await Effect.runPromise(agent.invokeMessage("weather in Shanghai?"))
    expect(reply).toBe("Shanghai is 24C.")
    const turns = await Effect.runPromise(agent.listTurns)
    expect(turns).toHaveLength(1)
    expect(turns[0]?.status).toBe("complete")
  })

  test("applyTools re-binds as an Effect and fails typed (no throw)", async () => {
    const arch = architect({ name: "ops-lead", connections: { sky: named("weather"), spare: any() }, prompt: "ops-lead/prompt" })
    const agent = await Effect.runPromise(inject(arch, {
      notation: store(),
      model: scriptOf(),
      connections: [weather, connection("github", [])]
    }))
    // an empty pool cannot satisfy every slot: typed BindFailed, not an exception
    const failed = await Effect.runPromise(agent.applyTools([]).pipe(Effect.map(() => null), Effect.either))
    expect(failed._tag).toBe("Left")
    if (failed._tag === "Left") expect((failed.left as { _tag: string })._tag).toBe("BindFailed")
    // re-bind succeeds and the pool takes effect on the next call
    const ok = await Effect.runPromise(agent.applyTools([weather, connection("github", [])]))
    expect(ok).toBeUndefined()
  })

  test("architectures mix-build: a child architecture injects recursively", async () => {
    const reviewer = architect({ name: "reviewer", connections: {}, prompt: "reviewer/prompt" })
    const lead = architect({
      name: "ops-lead",
      connections: { sky: named("weather") },
      agents: [reviewer],
      prompt: "ops-lead/prompt"
    })
    const agent = await Effect.runPromise(inject(lead, {
      notation: store(),
      model: scriptOf(
        // parent: calls the child (bound at injection from the same activation)
        { text: "", toolCalls: [{ id: "c1", name: "reviewer__invokeMessage", input: { message: "check" } }] },
        // child's own generation (same scripted provider)
        { text: "reviewed.", toolCalls: [] },
        // parent lands the reply
        { text: "lead done.", toolCalls: [] }
      ),
      connections: [weather]
    }))
    const reply = await Effect.runPromise(agent.invokeMessage("go"))
    expect(reply).toBe("lead done.")
  })

  test("the executable agent is a service provided through a Layer", async () => {
    const arch = architect({ name: "ops-lead", connections: { sky: named("weather") }, prompt: "ops-lead/prompt" })
    const program = Effect.gen(function* () {
      const agent = yield* Agent
      return yield* agent.invokeMessage("hello")
    }).pipe(Effect.provide(layer(arch, {
      notation: store(),
      model: scriptOf({ text: "hi from the layer.", toolCalls: [] }),
      connections: [weather]
    })))
    const reply = await Effect.runPromise(program)
    expect(reply).toBe("hi from the layer.")
  })

  test("max steps: typed MaxStepsExceeded, the turn closes as max-steps", async () => {
    const arch = architect({ name: "ops-lead", connections: {}, prompt: "ops-lead/prompt", maxSteps: 2 })
    const agent = await Effect.runPromise(inject(arch, {
      notation: store(),
      model: scriptOf(
        { text: "", toolCalls: [{ id: "1", name: "nope", input: {} }] },
        { text: "", toolCalls: [{ id: "2", name: "nope", input: {} }] },
        { text: "", toolCalls: [{ id: "3", name: "nope", input: {} }] }
      ),
      connections: []
    }))
    const failed = await Effect.runPromise(agent.invokeMessage("loop").pipe(Effect.map(() => null), Effect.either))
    expect(failed._tag).toBe("Left")
    if (failed._tag === "Left") expect((failed.left as { _tag: string })._tag).toBe("MaxStepsExceeded")
    const turns = await Effect.runPromise(agent.listTurns)
    expect(turns[0]?.status).toBe("max-steps")
  })

  test("the built-in provider connections are ordinary connections", () => {
    const model = openaiProvider({ apiKey: "k", model: "gpt-4o" })
    expect(model.name).toBe("openai")
    expect(model.generate).toBeDefined()
    // and they bind like any connection would
    expect(bind(named("openai"), model)).toHaveLength(0)
    void ({} as AgentShape)
  })
})

describe("architecture purity - no code in the blueprint", () => {
  test("a function anywhere in the blueprint fails loud with its path", () => {
    expect(() => architect({ name: "bad", connections: {}, prompt: "t/p",
      maxSteps: Number.isInteger(8) ? 8 : 8 })).not.toThrow()
    expect(() => architect({ name: "bad", connections: {}, prompt: "t/p",
      // @ts-expect-error - smuggling a function into the blueprint
      onData: () => console.log("leak") })).toThrow(/architecture "bad": architecture.onData is a function/)
  })

  test("a ready agent cannot ride the blueprint (closures are code)", () => {
    const readyAgent = { name: "r", invokeMessage: () => Effect.succeed("x"), applyTools: () => Effect.void,
      updateSystemPrompt: () => Effect.void, listTurns: Effect.succeed([]), listMessages: Effect.succeed([]),
      asConnection: { name: "r", tools: [] } } as unknown as ArchitectureInput
    expect(() => architect({ name: "bad", connections: {}, prompt: "t/p", agents: [readyAgent] }))
      .toThrow(/agents\[0\].invokeMessage is a function/)
  })

  test("class instances (console, fs namespace, Date) are rejected", () => {
    expect(() => architect({ name: "bad", connections: {}, prompt: "t/p",
      // @ts-expect-error - smuggling a namespace object
      io: console })).toThrow(/pure data/)
    expect(() => architect({ name: "bad", connections: {}, prompt: "t/p",
      // @ts-expect-error - smuggling a class instance
      at: new Date() })).toThrow(/architecture.at is not a plain object/)
  })

  test("accessor properties (getters run code on read) are rejected", () => {
    const sneaky: Record<string, unknown> = { name: "bad", connections: {}, prompt: "t/p" }
    Object.defineProperty(sneaky, "lazy", { enumerable: true, get: () => console.log("side effect") })
    expect(() => architect(sneaky as unknown as ArchitectureInput)).toThrow(/architecture.lazy is an accessor property/)
  })

  test("a valid pure-data blueprint passes the walk", () => {
    expect(() => architect({ name: "ok", connections: { sky: named("weather") }, prompt: "ok/p", maxSteps: 4 })).not.toThrow()
  })
})
