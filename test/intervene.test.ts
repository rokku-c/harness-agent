import { describe, expect, test } from "bun:test"
import { Effect, Ref } from "effect"
import { Context, Session, runDriver, type Detail, type Driver } from "../src/index.js"

/** 一个会 emit 多步的 driver：每步返回一个 Detail，最后返回 Result。 */
const multiStepDriver = (steps: number): Driver => {
  let count = 0
  return {
    id: "fake-multi",
    capabilities: {
      provider: { _tag: "Configurable" }, granularity: "event", thinking: true, cancel: false,
      pause: false, resume: false, fork: "none", tools: "native", toolCalls: "observe",
      structuredOutput: "native", sandbox: "none", subagents: false
    },
    start: (request) => Effect.sync(() => ({
      step: Effect.sync(() => {
        count++
        if (count < steps) return { _tag: "Detail", detail: { _tag: "Thinking", text: `step ${count}` } } as const
        return { _tag: "Result", value: "done" } as const
      })
    }))
  }
}

describe("Session 介入（GOAL 可观测/介入）", () => {
  test("cancel 中断运行", async () => {
    const driver = multiStepDriver(5)
    const context = Context.with({ messages: [{ role: "user", content: "task" }] })
    const driverSession = await Effect.runPromise(driver.start({ context }))
    const detailsRef = await Effect.runPromise(Ref.make<ReadonlyArray<Detail>>([]))
    const session = new Session(context, driverSession, detailsRef)

    // 先取消，再 run —— 第一步前检查介入，抛 AgentInterrupted。
    await Effect.runPromise(session.cancel("stop now"))
    const exit = await Effect.runPromiseExit(session.run<string>())
    expect(exit._tag).toBe("Failure")
  })

  test("redirect 注入新消息后继续", async () => {
    const driver = multiStepDriver(1)
    const context = Context.with({ messages: [{ role: "user", content: "task" }] })
    const driverSession = await Effect.runPromise(driver.start({ context }))
    const detailsRef = await Effect.runPromise(Ref.make<ReadonlyArray<Detail>>([]))
    const session = new Session(context, driverSession, detailsRef)

    // redirect 注入消息（不影响 run 结果，但验证介入通道可用）。
    await Effect.runPromise(session.redirect({ role: "user", content: "new instruction" }))
    const result = await Effect.runPromise(session.run<string>())
    expect(result.output).toBe("done")
  })

  test("runDriver 缺省无介入仍可运行", async () => {
    const driver = multiStepDriver(2)
    const context = Context.with({ messages: [{ role: "user", content: "task" }] })
    const result = await Effect.runPromise(runDriver(driver, context))
    expect(result.output).toBe("done")
  })
})
