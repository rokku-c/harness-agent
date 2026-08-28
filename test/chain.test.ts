import { describe, expect, test } from "bun:test"
import { Context, Data, Effect, Ref } from "effect"
import { Agent, type Chained } from "../src/agent.js"
import type { AgentProgram, Capabilities } from "../src/core.js"

const caps: Capabilities = {
  provider: { _tag: "Fixed", api: "test" },
  granularity: "run",
  thinking: false, cancel: false, pause: false, resume: false, fork: "none",
  tools: "none", toolCalls: "none", structuredOutput: "none", sandbox: "none"
}

const program = <I, O, E, R>(id: string, run: (input: I) => Effect.Effect<O, E, R>): AgentProgram<I, O, E, R> =>
  ({ id, capabilities: caps, run })

const formatText = program<string, string, never, never>("format", (input) => Effect.succeed("formatted: " + input))
const reviewText = program<string, string, never, never>("review", (input) => Effect.succeed("reviewed: " + input))

// Distinct tag typed step (E-union attribution requires this: implementedBy
// pins E = AgentError, so agent->agent chains collapse to AgentError and
// attribute via AgentFailure.agent - the union only stays distinct for
// distinct tag typed steps).
class StepTwoError extends Data.TaggedError("StepTwoError")<{ readonly reason: string }> {}

describe("Agent.then sequential composition", () => {
  test("a success chain feeds a's output into b as its input", async () => {
    const chain = Agent.then(formatText, reviewText)
    const result = await Effect.runPromise(chain("draft"))
    // type flow: string -> format -> string -> review -> string
    expect(result).toBe("reviewed: formatted: draft")
  })

  test("a failing first step propagates the error untouched and b never runs", async () => {
    const boom = new Error("boom")
    const failing = program<string, string, Error, never>("failing", () => Effect.fail(boom))
    const marker = program<string, string, never, never>("marker", (input) => Effect.succeed(input))
    const chain = Agent.then(failing, marker)
    const failure = await Effect.runPromise(Effect.flip(chain("x")))
    // the chain does not swallow or wrap a's error: same instance propagates
    expect(failure).toBe(boom)
    // short-circuit: b's side effect (Ref marker) never runs
    const bRan = await Effect.runPromise(Effect.gen(function* () {
      const ref = yield* Ref.make(false)
      const side = program<string, string, never, never>("side", (input) => Ref.set(ref, true).pipe(Effect.as(input)))
      yield* Effect.flip(Agent.then(failing, side)("x"))
      return yield* Ref.get(ref)
    }))
    expect(bRan).toBe(false)
  })

  test("a failing distinct-tag step surfaces its own E branch for attribution", async () => {
    const failing = program<string, string, StepTwoError, never>("step2", (input) => Effect.fail(new StepTwoError({ reason: "rejected: " + input })))
    const chain = Agent.then(formatText, failing)
    const failure = await Effect.runPromise(Effect.flip(chain("draft")))
    // the chain's E is E1 | E2; the distinct tag locates the failing step
    expect((failure as { _tag: string })._tag).toBe("StepTwoError")
    expect((failure as StepTwoError).reason).toBe("rejected: formatted: draft")
  })

  test("the chain requires the union of both steps' requirements (R1 | R2)", async () => {
    class ServiceA extends Context.Tag("svc-a")<ServiceA, { readonly a: () => string }>() {}
    class ServiceB extends Context.Tag("svc-b")<ServiceB, { readonly b: () => string }>() {}
    const withA = program<string, string, never, ServiceA>("a", (input) => Effect.flatMap(ServiceA, (svc) => Effect.succeed(svc.a() + input)))
    const withB = program<string, string, never, ServiceB>("b", (input) => Effect.flatMap(ServiceB, (svc) => Effect.succeed(svc.b() + input)))
    const chain = Agent.then(withA, withB)
    const result = await Effect.runPromise(
      Effect.provideService(Effect.provideService(chain("x"), ServiceA, { a: () => "A" }), ServiceB, { b: () => "B" })
    )
    expect(result).toBe("BAx")
  })

  test("@ts-expect-error: b.in must equal a.out (no any bridge)", () => {
    const text = program<string, string, never, never>("text", (input) => Effect.succeed(input))
    const takesNumber = program<number, string, never, never>("num", (input) => Effect.succeed(String(input)))
    // @ts-expect-error a.out (string) does not satisfy b.in (number)
    Agent.then(text, takesNumber)
    expect(true).toBe(true)
  })
})

describe("Agent.chain (Chained interface)", () => {
  test("three or more steps chain via .then with accumulated E/R unions", async () => {
    const triple = program<string, number, never, never>("parse", (input) => Effect.succeed(input.length))
    const double = program<number, number, never, never>("double", (input) => Effect.succeed(input * 2))
    const label = program<number, string, never, never>("label", (input) => Effect.succeed("n=" + input))
    const chain = Agent.chain(triple).then(double).then(label)
    const result = await Effect.runPromise(chain("hello"))
    expect(result).toBe("n=10") // 5 -> double -> 10 -> label
  })

  test("a chained failure short-circuits the remaining steps", async () => {
    const boom = new Error("mid-boom")
    const first = program<string, string, never, never>("first", (input) => Effect.succeed(input))
    const mid = program<string, string, Error, never>("mid", () => Effect.fail(boom))
    const last = program<string, string, never, never>("last", () => Effect.succeed("never"))
    const chain = Agent.chain(first).then(mid).then(last)
    const failure = await Effect.runPromise(Effect.flip(chain("x")))
    expect(failure).toBe(boom)
  })

  test("E/R unions accumulate through .then (typed)", () => {
    const text = program<string, string, never, never>("text", (input) => Effect.succeed(input))
    const errorStep = program<string, string, StepTwoError, never>("err", (input) => Effect.succeed(input))
    const chain = Agent.chain(text).then(errorStep)
    // tsc-enforced: the chain's E/R are the unions (never | StepTwoError / never)
    const _typed: Chained<string, string, StepTwoError, never> = chain
    expect(typeof chain).toBe("function")
  })

  test("@ts-expect-error: b.in must equal a.out through .then", () => {
    const text = program<string, string, never, never>("text", (input) => Effect.succeed(input))
    const takesNumber = program<number, string, never, never>("num", (input) => Effect.succeed(String(input)))
    // @ts-expect-error chain output (string) does not satisfy next input (number)
    Agent.chain(text).then(takesNumber)
    expect(true).toBe(true)
  })
})
