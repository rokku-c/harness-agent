import { Effect } from "effect"
import { Agent } from "./agent.js"
import type { AgentError, AgentProgram, Detail, Driver, Result, Until } from "./core.js"

/**
 * Handoff —— 回合制衔接磁吸链。
 *
 * 核心心智：一个 agent 的动作序列，每步的输出类型自动成为下一步的输入约束。
 * 直接内联 —— 无需预先 `const A = Agent.define(...)`，每步只声明「产出契约（until）
 * 和 执行者（driver）」，输入类型由磁吸自动推导。
 *
 *   const run = Handoff.step(Until.schema(Idea), driver)     // 输入 = run 参数类型
 *     .then(Until.schema(Verdict), driver2)                  // 输入自动 = Idea
 *     .when(Until.stop, driver3, (v) => v.ok)                // 条件磁吸
 *     .run(task)
 *
 * 与 Stage/then 的区别：Stage 是「同一 agent 的工具调用里程碑」；Handoff 是
 * 「agent 到 agent 的交接」，每步一个完整 agent 动作。两者正交。
 *
 * 错误通道固定为 AgentError（implementedBy 统一产出）；R 为各步 driver 需求并集。
 */

/** 一步的产物：类型化输出 + 过程细节。 */
export type HandoffResult<O> = Result<O>

/**
 * Chain<O, R> —— 磁吸链。
 * `O` = 当前链的输出类型；`then`/`when` 以它为磁吸接口。
 * `R` = 各步 driver 需求的并集。
 */
export class Chain<O, R = never> {
  constructor(
    readonly runFrom: (input: unknown) => Effect.Effect<Result<unknown>, AgentError, R>
  ) {}

  /** 磁吸衔接：上一个输出（`O`）自动成为本 agent 的输入。 */
  then<O2, R2>(
    until: Until<O2>,
    driver: Driver<R2>,
    id = "agent"
  ): Chain<O2, R | R2> {
    const agent: AgentProgram<O, O2, AgentError, R2> = Agent.define<O>(id)
      .returns(until)
      .implementedBy(driver)
    return new Chain<O2, R | R2>((input) =>
      this.runFrom(input).pipe(
        Effect.flatMap((prev) => agent.run(prev.output as O).pipe(
          Effect.map((next) => ({
            output: next.output,
            details: [...prev.details, ...next.details] as ReadonlyArray<Detail>
          }))
        ))
      )
    )
  }

  /** 条件磁吸：满足条件才执行下一步；不满足则跳过（输出保持上一步）。 */
  when<O2, R2>(
    until: Until<O2>,
    driver: Driver<R2>,
    cond: (previous: O) => boolean,
    id = "agent"
  ): Chain<O | O2, R | R2> {
    const agent: AgentProgram<O, O2, AgentError, R2> = Agent.define<O>(id)
      .returns(until)
      .implementedBy(driver)
    return new Chain<O | O2, R | R2>((input) =>
      this.runFrom(input).pipe(
        Effect.flatMap((prev) =>
          cond(prev.output as O)
            ? agent.run(prev.output as O).pipe(
                Effect.map((next) => ({
                  output: next.output,
                  details: [...prev.details, ...next.details] as ReadonlyArray<Detail>
                }))
              )
            : Effect.succeed({ output: prev.output as O | O2, details: prev.details })
        )
      )
    )
  }

  /** 执行：从初始输入跑完整个链。 */
  run<I>(input: I): Effect.Effect<HandoffResult<O>, AgentError, R> {
    return this.runFrom(input) as Effect.Effect<HandoffResult<O>, AgentError, R>
  }
}

export const Handoff = {
  /** 第一步：声明产出契约 + 执行者，输入由 `run` 参数推导。 */
  step: <O, R>(
    until: Until<O>,
    driver: Driver<R>,
    id = "agent"
  ): Chain<O, R> => {
    const agent: AgentProgram<unknown, O, AgentError, R> = Agent.define<unknown>(id)
      .returns(until)
      .implementedBy(driver)
    return new Chain<O, R>((input) =>
      agent.run(input).pipe(
        Effect.map((result) => ({ ...result, output: result.output as unknown }))
      )
    )
  },

  /** 无条件衔接。 */
  then: <O, O2, R, R2>(
    chain: Chain<O, R>,
    until: Until<O2>,
    driver: Driver<R2>,
    id = "agent"
  ): Chain<O2, R | R2> => chain.then(until, driver, id),

  /** 条件衔接。 */
  when: <O, O2, R, R2>(
    chain: Chain<O, R>,
    until: Until<O2>,
    driver: Driver<R2>,
    cond: (previous: O) => boolean,
    id = "agent"
  ): Chain<O | O2, R | R2> => chain.when(until, driver, cond, id),

  /** 执行。 */
  run: <O, R, I>(chain: Chain<O, R>, input: I): Effect.Effect<HandoffResult<O>, AgentError, R> =>
    chain.run(input)
}
