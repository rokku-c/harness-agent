import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { Agent, Handoff, Until, type Driver } from "../src/index.js"

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
type Idea = typeof Idea.Type
type Verdict = typeof Verdict.Type

describe("Handoff 磁吸链", () => {
  test("回合制衔接：A 提议 → Judge 判定 → 通过才接 B", async () => {
    const A = Agent.define<string>().returns(Until.schema(Idea))
      .implementedBy(fakeDriver((input) => input.includes("problem")
        ? { idea: "用 Schema 强类型工具输入", promising: true }
        : { idea: "无", promising: false }))
    const Judge = Agent.define<Idea>().returns(Until.schema(Verdict))
      .implementedBy(fakeDriver((input) => input.includes("promising")
        ? { verdict: "ok" }
        : { verdict: "revise" }))
    const B = Agent.define<Verdict>().returns(Until.stop)
      .implementedBy(fakeDriver((input) => `采纳: ${input}`))

    const chain = Handoff.step(A).then(Judge)
    const result = await Effect.runPromise(chain.run("有个 problem"))
    expect((result.output as any).verdict).toBe("ok")

    // 磁吸：A 的输出类型（Idea）自动成为 Judge 的输入 —— 类型在编译期已验证。
    const full = Handoff.step(A).then(Judge).when(B, (v) => v.verdict === "ok")
    const fullResult = await Effect.runPromise(full.run("有个 problem"))
    // B 收到的是 Judge 的 verdict（经 toMessage 序列化注入）。
    expect(fullResult.output).toContain('"verdict": "ok"')
  })

  test("变动衔接：观测驱动 —— 观测到某 Detail 才推进", async () => {
    // 观测驱动是 Session.step + 递归的组合（见 examples/24）；这里验证
    // 链的输出类型能传递到判定。
    const A = Agent.define<string>().returns(Until.stop)
      .implementedBy(fakeDriver(() => "已观测到变动"))
    const B = Agent.define<string>().returns(Until.stop)
      .implementedBy(fakeDriver((input) => `B 收到: ${input}`))

    const chain = Handoff.step(A).then(B)
    const result = await Effect.runPromise(chain.run("start"))
    expect(result.output).toBe("B 收到: 已观测到变动")
  })

  test("判断门：条件不满足时跳过下一步", async () => {
    const A = Agent.define<string>().returns(Until.schema(Idea))
      .implementedBy(fakeDriver(() => ({ idea: "无价值", promising: false })))
    const B = Agent.define<Idea>().returns(Until.stop)
      .implementedBy(fakeDriver((input) => `B 处理: ${(input as any).idea}`))

    const chain = Handoff.step(A).when(B, (idea) => idea.promising)
    const result = await Effect.runPromise(chain.run("task"))
    // 条件不满足：跳过 B，输出保持 A 的 idea（无 promising → 跳过）。
    expect((result.output as any).idea).toBe("无价值")
  })

  test("磁吸类型约束：下一步输入必须等于上一步输出", () => {
    // Judge 的输入是 Idea，但 chain 的输出也是 Idea —— 类型匹配。
    // 这里用一个「输入类型不匹配」的 agent 验证编译期拒绝（@ts-expect-error）。
    const A = Agent.define<string>().returns(Until.schema(Idea)).implementedBy(fakeDriver(() => ({ idea: "x", promising: true })))
    const WrongInput = Agent.define<number>().returns(Until.stop).implementedBy(fakeDriver(() => "wrong"))
    // @ts-expect-error —— WrongInput 输入是 number，但 chain 输出是 Idea，类型不匹配。
    Handoff.step(A).then(WrongInput)
  })
})
