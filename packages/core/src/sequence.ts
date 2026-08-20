import { Effect } from "effect"
import type { AgentProgram, AgentError, Detail, Result } from "./core.js"

/**
 * Handoff —— 回合制衔接磁吸链。
 *
 * 核心心智：一个 agent 的动作序列，每步的输出类型自动成为下一步的输入约束。
 * 「磁吸」体现在类型层：`Chain<O>` 携带当前链的输出类型 `O`，`.then()` / `.when()`
 * 要求下一步 agent 的输入恰为 `O` —— 不匹配编译错误，匹配则自动推导下一步输出。
 *
 *   const run = Handoff.step(A)                    // A: AgentProgram<I, Idea>
 *     .then(Judge)                                 // Judge 输入必须是 Idea
 *     .when(B, (idea) => idea.promising)           // 满足才接 B
 *     .run(task)
 *
 * 实现用闭包组合（每步包装上一个 effect），无需异构数组 —— 类型零 any。
 * 与 Stage/then 的区别：Stage 是「同一 agent 的工具调用里程碑」；Handoff 是
 * 「agent 到 agent 的交接」，每步一个完整 agent 动作。两者正交。
 */

/** 一步的产物：类型化输出 + 过程细节。 */
export type HandoffResult<O> = Result<O>

/**
 * Chain<O, E, R> —— 磁吸链。
 * `O` = 当前链的输出类型；`then`/`when` 以它为磁吸接口。
 * 内部是一个闭包组合的 Effect，`E`/`R` 随链递增（各步错误/需求取并集）。
 */
export class Chain<O, E = AgentError, R = never> {
  constructor(
    readonly runFrom: (input: unknown) => Effect.Effect<Result<unknown>, E, R>
  ) {}

  /** 磁吸衔接：上一个输出（`O`）自动成为本 agent 的输入。 */
  then<O2, E2, R2>(
    agent: AgentProgram<O, O2, E2, R2>
  ): Chain<O2, E | E2, R | R2> {
    return new Chain<O2, E | E2, R | R2>((input) =>
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
  when<O2, E2, R2>(
    agent: AgentProgram<O, O2, E2, R2>,
    cond: (previous: O) => boolean
  ): Chain<O | O2, E | E2, R | R2> {
    return new Chain<O | O2, E | E2, R | R2>((input) =>
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
  run(input: unknown): Effect.Effect<HandoffResult<O>, E, R> {
    return this.runFrom(input) as Effect.Effect<HandoffResult<O>, E, R>
  }
}

export const Handoff = {
  /** 第一步：定义一个 agent 动作。 */
  step: <I, O, E, R>(
    agent: AgentProgram<I, O, E, R>
  ): Chain<O, E, R> => new Chain<O, E, R>((input) =>
    agent.run(input as I).pipe(
      Effect.map((result) => ({ ...result, output: result.output as unknown }))
    )
  ),

  /** 无条件衔接。 */
  then: <O, O2, E, R, E2, R2>(
    chain: Chain<O, E, R>,
    agent: AgentProgram<O, O2, E2, R2>
  ): Chain<O2, E | E2, R | R2> => chain.then(agent),

  /** 条件衔接。 */
  when: <O, O2, E, R, E2, R2>(
    chain: Chain<O, E, R>,
    agent: AgentProgram<O, O2, E2, R2>,
    cond: (previous: O) => boolean
  ): Chain<O | O2, E | E2, R | R2> => chain.when(agent, cond),

  /** 执行。 */
  run: <O, E, R>(chain: Chain<O, E, R>, input: unknown): Effect.Effect<HandoffResult<O>, E, R> =>
    chain.run(input)
}
