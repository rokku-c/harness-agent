import { describe, expect, test } from "bun:test"
import { Effect, pipe, Ref } from "effect"
import {
  Context, Session, Stage, then,
  progress, runStaged, runStagedDriver, planOf,
  type Driver,
} from "../src/index.js"

/**
 * fake driver：逐事件 emit 工具调用（按 stage 顺序），最终 emit Result。
 * 用来验证「按阶段推进 + gate 解锁」语义真正在 step 会话上发生。
 */
const stagedFakeDriver = (marks: ReadonlyArray<string>): Driver => {
  let i = 0
  return {
    id: "fake-staged",
    capabilities: {
      provider: { _tag: "Configurable" }, granularity: "event", thinking: false,
      cancel: false, pause: false, resume: false, fork: "none",
      tools: "native", toolCalls: "intercept", structuredOutput: "native", sandbox: "none", subagents: false,
    },
    start: () => Effect.sync(() => ({
      step: Effect.sync(() => {
        if (i < marks.length) {
          const name = marks[i]!
          i += 1
          return { _tag: "Detail", detail: { _tag: "ToolCall", id: `t${i}`, name, input: {} } } as const
        }
        return { _tag: "Result", value: { done: true, calls: i } } as const
      }),
    })),
  }
}

const buildStage = () => {
  const first = Stage.guard("list_dir", { always: "你是只读审查者", tools: { submit: "deny" } })
  return then("submit", { always: "现在收敛" })(then("read_file", { always: "看到代码，开始找问题" })(first))
}

const reviewStage = {
  _tag: "Stage",
  marks: [
    { tool: "list_dir", gate: { always: "你是审查者", tools: { list_dir: "allow", submit: "deny" } } },
    { tool: "read_file", gate: { always: "看到代码，开始找问题" } },
    { tool: "submit", gate: { tools: { commit: "deny" } } },
  ],
} as const

describe("engine · progress（推进契约，纯组合子）", () => {
  test("未到达：index 0，第一阶段 gate 待解锁", () => {
    const p = progress(reviewStage, [])
    expect(p.index).toBe(0)
    expect(p.pending).toEqual(["list_dir", "read_file", "submit"])
    expect(p.gatesApplied).toEqual([])
    expect(p.nextGate?.always).toBe("你是审查者")
  })

  test("到达第一工具：index 1，第一阶段 gate 生效", () => {
    const p = progress(reviewStage, ["list_dir"])
    expect(p.index).toBe(1)
    expect(p.reached).toEqual(["list_dir"])
    expect(p.gatesApplied.map((g) => g.always)).toEqual(["你是审查者"])
    expect(p.nextGate?.always).toBe("看到代码，开始找问题")
  })

  test("到达前两工具：累积解锁两个 gate，第三阶段未生效", () => {
    const p = progress(reviewStage, ["list_dir", "read_file"])
    expect(p.index).toBe(2)
    expect(p.gatesApplied.map((g) => g.always)).toEqual(["你是审查者", "看到代码，开始找问题"])
    expect(p.pending).toEqual(["submit"])
    expect(p.nextGate?.tools?.commit).toBe("deny")
  })

  test("乱序/缺前序到达不推进（阶段 i 未到达，阶段 i+1 不解锁）", () => {
    const p = progress(reviewStage, ["read_file"])
    expect(p.index).toBe(0)
    expect(p.gatesApplied).toEqual([])
  })

  test("planOf 输出推进路径", () => {
    expect(planOf(reviewStage)).toEqual(["list_dir", "read_file", "submit"])
  })
})

describe("engine · runStaged（运行时，step 会话上逐步推进）", () => {
  test("按 marks 逐工具推进，gate 随阶段累积解锁", async () => {
    const driver = stagedFakeDriver(["list_dir", "read_file", "submit"])
    const context = Context.with({ messages: [{ role: "user", content: "task" }] })
    const result = await Effect.runPromise(runStagedDriver(driver, context, buildStage()))

    expect(result.output).toEqual({ done: true, calls: 3 })
    expect(result.details.map((d) => (d as { name?: string }).name)).toEqual(["list_dir", "read_file", "submit"])
    expect(result.reachedTools).toEqual(["list_dir", "read_file", "submit"])
    expect(result.gatesApplied.map((g) => g.always))
      .toEqual(["你是只读审查者", "看到代码，开始找问题", "现在收敛"])
    expect(result.progression.map((p) => p.index)).toEqual([1, 2, 3])
  })

  test("部分到达：只到第一工具，仅第一 gate 生效", async () => {
    const driver = stagedFakeDriver(["list_dir"])
    const context = Context.with({ messages: [{ role: "user", content: "task" }] })
    const result = await Effect.runPromise(runStagedDriver(driver, context, buildStage()))

    expect(result.reachedTools).toEqual(["list_dir"])
    expect(result.gatesApplied).toEqual([{ always: "你是只读审查者", tools: { submit: "deny" } }])
    expect(result.output).toEqual({ done: true, calls: 1 })
  })

  test("driver 一步产 Result（不流式）：契约仅表达，不推进", async () => {
    const oneShot: Driver = {
      id: "fake-oneshot",
      capabilities: {
        provider: { _tag: "Configurable" }, granularity: "run", thinking: false,
        cancel: false, pause: false, resume: false, fork: "none",
        tools: "native", toolCalls: "observe", structuredOutput: "native", sandbox: "none", subagents: false,
      },
      start: () => Effect.sync(() => ({ step: Effect.sync(() => ({ _tag: "Result", value: { ok: true } } as const)) })),
    }
    const context = Context.with({ messages: [{ role: "user", content: "task" }] })
    const result = await Effect.runPromise(runStagedDriver(oneShot, context, buildStage()))

    expect(result.output).toEqual({ ok: true })
    expect(result.details).toEqual([])
    expect(result.reachedTools).toEqual([])
    expect(result.gatesApplied).toEqual([])
    expect(result.progression).toEqual([])
  })

  test("用 Session + driverSession 手喂 runStaged 也等价", async () => {
    const driver = stagedFakeDriver(["list_dir", "read_file", "submit"])
    const context = Context.with({ messages: [{ role: "user", content: "task" }] })
    const ds = await Effect.runPromise(driver.start({ context }))
    const detailsRef = await Effect.runPromise(Ref.make<ReadonlyArray<import("../src/index.js").Detail>>([]))
    const session = new Session(context, ds, detailsRef)
    const result = await Effect.runPromise(runStaged(session, buildStage()))

    expect(result.reachedTools).toEqual(["list_dir", "read_file", "submit"])
    expect(result.output).toEqual({ done: true, calls: 3 })
  })
})
