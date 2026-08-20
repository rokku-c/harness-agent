import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { AgentKeeper, ComposedAgent, Messenger } from "../src/index.js"

/** 一个永远 emit Detail 的 fake driver（永不完成）。 */
const neverDriver = {
  id: "fake-never",
  capabilities: {
    provider: { _tag: "Configurable" }, granularity: "event", thinking: true, cancel: true,
    pause: true, resume: true, fork: "none", tools: "native", toolCalls: "observe",
    structuredOutput: "native", sandbox: "none", subagents: false
  },
  start: (_request: unknown) => Effect.sync(() => ({
    step: Effect.sync(() => ({ _tag: "Detail", detail: { _tag: "Thinking", text: "thinking" } }))
  }))
} as const

const neverAgent = {
  id: "never",
  capabilities: neverDriver.capabilities,
  run: (input: string) => Effect.gen(function*() {
    const ds = yield* neverDriver.start({ context: { messages: [{ role: "user", content: input }] } } as never)
    const go = (): Effect.Effect<string, never, never> =>
      ds.step.pipe(
        Effect.mapError(() => new Error("x") as never),
        Effect.flatMap((event: { _tag: string }) => event._tag === "Detail" ? go() : Effect.succeed(input))
      )
    return yield* go()
  }),
} as const

const makeKeeper = (capacity = 8) =>
  Effect.scoped(Effect.gen(function*() {
    return yield* AgentKeeper.make(ComposedAgent.make(neverAgent as any), { capacity })
  }))

describe("AgentKeeper 介入（GOAL 可介入）", () => {
  test("running 暴露当前句柄，cancel 中断长跑 job", async () => {
    const program = Effect.scoped(Effect.gen(function*() {
      const keeper = yield* AgentKeeper.make(ComposedAgent.make(neverAgent as any), { capacity: 8 })
      const sendFiber = yield* Effect.fork(keeper.send("task").pipe(Effect.either))
      yield* Effect.sleep("200 millis")
      const current = yield* keeper.running
      expect(Option.isSome(current)).toBe(true)
      if (Option.isSome(current)) {
        yield* current.value.cancel
      }
      const exit = yield* sendFiber.await
      return exit._tag
    }))
    const result = await Effect.runPromise(program.pipe(Effect.provide(Messenger.layer)))
    expect(result).toBe("Failure")
  })

  test("无运行时 running 为 None", async () => {
    const program = Effect.scoped(Effect.gen(function*() {
      const keeper = yield* AgentKeeper.make(ComposedAgent.make(neverAgent as any), { capacity: 8 })
      const current = yield* keeper.running
      return Option.isNone(current)
    }))
    const result = await Effect.runPromise(program.pipe(Effect.provide(Messenger.layer)))
    expect(result).toBe(true)
  })
})
