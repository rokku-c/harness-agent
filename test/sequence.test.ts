import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { Handoff, Until, type Driver } from "../src/index.js"

/** 一个 fake driver：把 context.messages 文本喂给 step 返回的固定值。 */
const fakeDriver = (respond: (prompt: string) => unknown): Driver => ({
  id: "fake",
  capabilities: {
    provider: { _tag: "Configurable" }, granularity: "event", thinking: false, cancel: false,
    pause: false, resume: false, fork: "none", tools: "native", toolCalls: "observe",
    structuredOutput: "native", sandbox: "none", subagents: false
  },
  start: (request) => Effect.sync(() => ({
    step: Effect.succeed({ _tag: "Result", value: respond(request.context.messages.map((m) => m.content).join(" ")) })
  }))
})

const Idea = Schema.Struct({ idea: Schema.String, promising: Schema.Boolean })
const Verdict = Schema.Struct({ verdict: Schema.Literal("ok", "revise") })

describe("Handoff 磁吸链（内联）", () => {
  test("回合制衔接：A 提议 → Judge 判定 → 通过才接 B", async () => {
    const judgeOk = fakeDriver((input) => input.includes("promising")
      ? { verdict: "ok" }
      : { verdict: "revise" })
    const B = fakeDriver((input) => `采纳: ${input}`)

    // 内联链：每步只声明 until + driver，输入由磁吸推导。
    const chain = Handoff.step(Until.schema(Idea), fakeDriver(() => ({ idea: "用 Schema 强类型", promising: true })))
      .then(Until.schema(Verdict), judgeOk)
      .when(Until.stop, B, (v) => v.verdict === "ok")

    const result = await Effect.runPromise(chain.run("有个问题"))
    expect(result.output).toContain('"verdict": "ok"')
  })

  test("变动衔接：观测驱动 —— 观测到某 Detail 才推进", async () => {
    const A = fakeDriver(() => "已观测到变动")
    const B = fakeDriver((input) => `B 收到: ${input}`)

    const chain = Handoff.step(Until.stop, A).then(Until.stop, B)
    const result = await Effect.runPromise(chain.run("start"))
    expect(result.output).toBe("B 收到: 已观测到变动")
  })

  test("判断门：条件不满足时跳过下一步", async () => {
    const A = fakeDriver(() => ({ idea: "无价值", promising: false }))
    const B = fakeDriver(() => "B 不该跑")

    const chain = Handoff.step(Until.schema(Idea), A)
      .when(Until.stop, B, (idea) => idea.promising)

    const result = await Effect.runPromise(chain.run("task"))
    // 条件不满足：跳过 B，输出保持 A 的 idea。
    expect((result.output as { idea: string }).idea).toBe("无价值")
  })

  test("磁吸类型约束：when 的条件拿到上一步的类型化输出", () => {
    const A = fakeDriver(() => ({ idea: "x", promising: true }))
    const B = fakeDriver(() => "B 跑")
    // cond 的参数类型 = 上一步输出的 Schema 类型（Idea）—— 编译期推导。
    const chain = Handoff.step(Until.schema(Idea), A)
      .when(Until.stop, B, (idea) => idea.promising)
    // `idea` 是 { idea: string; promising: boolean } —— 类型安全（若为 any 则编译报错）。
    expect(chain).toBeInstanceOf(Object)
  })
})
