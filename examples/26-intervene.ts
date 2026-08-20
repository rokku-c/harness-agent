import { Effect, Option } from "effect"
import { AgentKeeper, ComposedAgent, Messenger } from "effect-agent"
import type { AgentProgram, Driver, Detail } from "effect-agent"

/**
 * 示例 26：可观测 / 介入（GOAL「两条对称属性」之二）。
 *
 * 用 AgentKeeper 保持 agent 存活，通过 `running` 拿到当前运行句柄，
 * 宿主（人/agent）可 cancel —— 这就是「介入」。
 *
 * 用法：
 *   bun run example 26-intervene
 */

/** 一个「会跑很久」的 fake agent：每步 emit 一个 Thinking Detail。 */
const slowDriver: Driver = {
  id: "fake-slow",
  capabilities: {
    provider: { _tag: "Configurable" }, granularity: "event", thinking: true, cancel: true,
    pause: true, resume: true, fork: "none", tools: "native", toolCalls: "observe",
    structuredOutput: "native", sandbox: "none", subagents: false
  },
  start: (request) => Effect.sync(() => ({
    step: Effect.sync(() => ({
      _tag: "Detail",
      detail: { _tag: "Thinking", text: `思考中：${request.context.messages.map((m) => m.content).join("")}` }
    }))
  }))
}

const slowAgent: AgentProgram<string, string> = {
  id: "slow",
  capabilities: slowDriver.capabilities,
  run: (input) => Effect.gen(function*() {
    const driverSession = yield* slowDriver.start({
      context: { messages: [{ role: "user", content: input }] } as never
    })
    const go = (details: ReadonlyArray<Detail>): Effect.Effect<{ output: string; details: ReadonlyArray<Detail> }, never, never> =>
      driverSession.step.pipe(
        Effect.mapError(() => new Error("agent step failed") as never),
        Effect.flatMap((event) => event._tag === "Detail"
          ? go([...details, event.detail])
          : Effect.succeed({ output: input, details }))
      )
    return yield* go([])
  }),
}

const program = Effect.scoped(Effect.gen(function*() {
  const composed = ComposedAgent.make(slowAgent)
  const keeper = yield* AgentKeeper.make(composed, { capacity: 8 })

  // 投递一个任务（会一直跑），fork 出去。
  const sendFiber = yield* Effect.fork(keeper.send("长跑任务").pipe(Effect.either))
  yield* Effect.sleep("200 millis")

  // 读当前运行句柄并取消。
  const current = yield* keeper.running
  if (Option.isSome(current)) {
    console.error("[keeper] 拿到运行句柄，取消中…")
    yield* current.value.cancel
    console.error("[keeper] 已取消")
  } else {
    console.error("[keeper] 无运行中的 job")
  }

  // 等 send 的结果（应因中断而失败）。
  const exit = yield* sendFiber.await
  return exit._tag === "Failure" ? "interrupted" : "done"
}))

const result = await Effect.runPromise(
  program.pipe(Effect.provide(Messenger.layer))
)

console.error("介入结果:", result === "interrupted" ? "已介入（agent 被取消）" : "完成")
