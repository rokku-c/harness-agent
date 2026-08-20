import { Effect, Ref, Schema } from "effect"
import { Agent, Context, Harness, Session, Until, type Detail, type Driver } from "effect-agent"
import { DetailHook } from "./hooks/detailed-review.js"

/**
 * 示例 24：观测驱动衔接 + Session fork 陈述句。
 *
 * 两个心智：
 *
 * 1) 观测驱动衔接 = `Session.step` + 递归的组合（不是新概念）：
 *    逐步推进一个 session，观测到某个 Detail（如 Thinking）才交给下一个 agent。
 *    `observeUntil` 是一个普通函数（Effect 递归），组合出「变动 → 衔接」。
 *
 * 2) Session fork 是陈述句：`capabilities.fork` 只声明「能不能 fork、用什么机制」
 *   （"node" | "session" | "none"）。「fork 出来做什么、每 10s 汇报进度」是用户的
 *   业务 —— 用 `Agent.run` + `Effect.repeat` + Timer 组合，框架不管。
 *
 * 用法：
 *   bun run example 24-observe-handoff
 */

/** 推进 session 直到观测到匹配的 Detail 或拿到结果（组合，非新 API）。 */
const observeUntil = (session: Session, pred: (detail: Detail) => boolean): Effect.Effect<unknown, Error, never> =>
  session.step().pipe(
    Effect.mapError((error) => new Error(String(error))),
    Effect.flatMap((event) =>
      event._tag === "Detail" && pred(event.detail)
        ? Effect.succeed(event.detail)
        : event._tag === "Result"
          ? Effect.succeed(event.value)
          : observeUntil(session, pred))
  )

/** fake driver：逐步 emit 一个 Thinking Detail。 */
const thinkingDriver: Driver = {
  id: "fake-thinking",
  capabilities: {
    provider: { _tag: "Configurable" }, granularity: "event", thinking: true, cancel: false,
    pause: false, resume: false, fork: "session", tools: "native", toolCalls: "observe",
    structuredOutput: "native", sandbox: "none", subagents: false
  },
  start: (request) => Effect.sync(() => ({
    step: Effect.succeed({
      _tag: "Detail",
      detail: { _tag: "Thinking", text: `思考中：${request.context.messages.map((m) => m.content).join("")}` }
    })
  }))
}

const Conclusion = Schema.Struct({ conclusion: Schema.String })

const B = Agent.define<unknown>().returns(Until.schema(Conclusion))
  .implementedBy(Harness.withHooks({
    id: "fake-b",
    capabilities: {
      provider: { _tag: "Configurable" }, granularity: "event", thinking: false, cancel: false,
      pause: false, resume: false, fork: "none", tools: "native", toolCalls: "observe",
      structuredOutput: "native", sandbox: "none", subagents: false
    },
    start: (request) => Effect.sync(() => ({
      step: Effect.succeed({
        _tag: "Result",
        value: { conclusion: `基于观测「${request.context.messages.map((m) => m.content).join("")}」作出判断` }
      })
    }))
  }, DetailHook))

const program = Effect.gen(function*() {
  // 1) 启动 thinking driver 的 session（不跑完 —— 停在 Thinking Detail）。
  const driver = Harness.withHooks(thinkingDriver, DetailHook)
  const ctx = Context.with({ messages: [{ role: "user", content: "分析这个架构" }] })
  const driverSession = yield* driver.start({ context: ctx })
  const detailsRef = yield* Ref.make<ReadonlyArray<Detail>>([])
  const session = new Session(ctx, driverSession, detailsRef)

  // 2) 观测驱动衔接：推进到第一个 Thinking，交给 B 判断。
  const observed = yield* observeUntil(session, (d) => d._tag === "Thinking")
  const result = yield* B.run(observed)

  return { conclusion: result.output.conclusion, fork: thinkingDriver.capabilities.fork }
})

const out = await Effect.runPromise(program)

console.log("\n=== 观测驱动衔接 ===")
console.log("  结论:", out.conclusion)
console.log("\n=== Session fork 陈述句 ===")
console.log("  thinking driver 声明 fork:", out.fork)
console.log("  （fork 用途 —— 每 10s 汇报进度 —— 是用户业务，用 Agent.run + Effect.repeat + Timer 组合）")
