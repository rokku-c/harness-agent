import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { Agent, AgentContext, memoryNotationStore, resolveNotation, Until, withNotation, type AgentError, type RunRequest } from "../src/index.js"

describe("notation", () => {
  const store = memoryNotationStore([
    { target: "greet", instructions: ["Hello {name}, welcome to {place}."] },
    { target: "multi", instructions: ["Line one: {a}.", "Line two: {b}."] }
  ])

  it("interpolates variables into the entry instructions", () => {
    expect(String(resolveNotation(store, "greet", { name: "Ada", place: "the lab" })))
      .toBe("Hello Ada, welcome to the lab.")
  })

  it("joins multiple instruction lines with newlines", () => {
    expect(String(resolveNotation(store, "multi", { a: 1, b: 2 }))).toBe("Line one: 1.\nLine two: 2.")
  })

  it("fails loud on a missing target - definition bug, not runtime error", () => {
    expect(() => resolveNotation(store, "nope", {})).toThrow(/no entry for target "nope"/)
  })

  it("fails loud on a referenced-but-unpassed variable", () => {
    expect(() => resolveNotation(store, "greet", { name: "Ada" })).toThrow(/references \{place\}/)
  })

  it("withNotation hands the resolver to the definition input", async () => {
    const runs: Array<unknown> = []
    const capabilities = {
      provider: { _tag: "Fixed", api: "test" }, granularity: "turn", thinking: false,
      cancel: false, pause: false, resume: false, fork: "none",
      tools: "none", toolCalls: "none", structuredOutput: "none", sandbox: "none"
    } as const
    const driver = {
      id: "fake",
      capabilities,
      run: <A, R>(request: RunRequest<A, R>): Effect.Effect<A, AgentError, unknown> => {
        runs.push(request.context.render())
        return Effect.succeed("done" as A)
      }
    }
    const Greet = Agent
      .define<string>("greet", withNotation(store, (name, nl) => AgentContext.text(nl("greet", { name, place: "town" }))))
      .returns(Until.stop)
      .implementedBy(driver)
    // the fake driver keeps R generic (Driver<unknown>); the test consumes it as never
    await Effect.runPromise(Greet.run("Ada") as Effect.Effect<string, AgentError>)
    expect(runs[0]).toBe("Text: Hello Ada, welcome to town.")
  })
})
