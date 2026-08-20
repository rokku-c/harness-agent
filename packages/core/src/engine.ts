import { Effect, Ref } from "effect"
import type { AgentError, Context, Detail, Driver, StepEvent } from "./core.js"
import { Session } from "./core.js"
import type { Gate, Stage } from "./orchestration.js"

/**
 * 阶段推进引擎 —— 让 agent 按 `Stage.marks` 逐步推进；每到达一个 mark 的工具调用，
 * 对应 Gate 解锁（改 always / 挂容器 / 控工具），下一阶段生效。
 *
 * 关键洞察：真实 driver（claude-code 等）是「一次跑完」，不逐工具流式暴露。所以引擎
 * 分解成两层，不要过度实现：
 *
 *   1. 推进契约（纯组合子）：`progress` —— 任何 driver 都能用来声明/校验推进路径。
 *   2. 逐步推进（运行时）：`runStaged` —— 在支持 step 的 driver 上真正按阶段走，
 *      每到达一个 mark 的工具调用就推进阶段（其 Gate 解锁下一阶段），直到 driver 产出 Result。
 *
 * 语义：阶段 i 的工具调用未到达前，阶段 i+1 的 Gate 不生效。Gate 在「到达该 mark 工具」的
 * 瞬间并入已生效集合（累积解锁）。可与 `Until.toolCall(at?)` 配合：到第 at 个工具调用即到边界。
 */

/* ─────────────────────── 推进契约（纯组合子） ─────────────────────── */

/** 推进里程碑：当前阶段索引、已到达哪些工具、生效哪些 Gate。 */
export interface StageProgress {
  /** 已到达的阶段数（= 已解锁的阶段数）。 */
  readonly index: number
  /** 已按序到达的工具调用名。 */
  readonly reached: ReadonlyArray<string>
  /** 尚未到达的 mark（绝对工具名），按序。 */
  readonly pending: ReadonlyArray<string>
  /** 已生效的 Gate（累积解锁）。 */
  readonly gatesApplied: ReadonlyArray<Gate>
  /** 下一步到达将解锁的 Gate（当前未生效的 mark 的 gate）。 */
  readonly nextGate: Gate | undefined
}

/**
 * 纯推进视图：给定已到达的工具调用名（按序），计算当前阶段。
 * 阶段 i 的规则：marks[0..i-1] 的工具都已到达 → index = i；marks[i] 的 Gate 尚未生效。
 */
export const progress = (stage: Stage, reached: ReadonlyArray<string>): StageProgress => {
  const inReached = new Set(reached)
  let index = 0
  while (index < stage.marks.length && inReached.has(stage.marks[index].tool)) index += 1
  const gatesApplied = stage.marks.slice(0, index).flatMap((mark) => mark.gate ? [mark.gate] : [])
  const pending = stage.marks.slice(index).map((mark) => mark.tool)
  const nextGate = stage.marks[index]?.gate
  return {
    index,
    reached: stage.marks.slice(0, index).map((mark) => mark.tool),
    pending,
    gatesApplied,
    nextGate,
  }
}

/** 推进路径的工具名序列（供契约场景直接使用）。 */
export const planOf = (stage: Stage): ReadonlyArray<string> => stage.marks.map((mark) => mark.tool)

/* ─────────────────────── 运行时：逐步推进 ─────────────────────── */

/** 阶段推进的运行结果：输出 + 过程 detail + 逐阶段里程碑。 */
export interface StagedResult {
  readonly output: unknown
  /** 驱动流出的全部内部过程（thinking/text/toolCall/toolResult）。 */
  readonly details: ReadonlyArray<Detail>
  /** 逐阶段推进里程碑（每解锁一个 mark 记录一帧，含最终帧）。 */
  readonly progression: ReadonlyArray<StageProgress>
  /** 累积生效的 Gate。 */
  readonly gatesApplied: ReadonlyArray<Gate>
  /** 最终按序到达的工具调用名。 */
  readonly reachedTools: ReadonlyArray<string>
}

/**
 * 在支持 step 的 driver 上按阶段推进：
 * 反复 `session.step()`，每观察到当前 mark 的工具调用就推进阶段（其 Gate 解锁下一阶段），
 * 直到 driver 产出 Result。返回推进过程与最终输出。
 * 若 driver 一步产出 Result（不流式工具调用），progression 长度为 1 —— 契约仅表达，不真正推进。
 */
export const runStaged = (
  session: Session,
  stage: Stage
): Effect.Effect<StagedResult, AgentError, never> => Effect.gen(function*() {
  const detailsRef = yield* Ref.make<ReadonlyArray<Detail>>([])
  const outputRef = yield* Ref.make<unknown>(undefined)

  const go: Effect.Effect<void, AgentError, never> = session.driverSession.step.pipe(
    Effect.flatMap((event: StepEvent): Effect.Effect<void, AgentError, never> =>
      event._tag === "Detail"
        ? Ref.update(detailsRef, (list) => [...list, event.detail]).pipe(Effect.zipRight(go))
        : Ref.set(outputRef, event.value).pipe(Effect.zipRight(Effect.void))
    )
  )

  yield* go

  const details = yield* Ref.get(detailsRef)
  const output = yield* Ref.get(outputRef)

  // 按序到达的工具：只看 stage 声明路径上的工具在 details 中出现的顺序。
  const inDetails = new Set(details.filter((d): d is Extract<Detail, { _tag: "ToolCall" }> => d._tag === "ToolCall").map((t) => t.name))
  const reachedTools = stage.marks.filter((mark) => inDetails.has(mark.tool)).map((mark) => mark.tool)

  // 里程碑：从 0 到最终到达数，每帧记一次推进。
  const progression = reachedTools.map((_tool, i) =>
    progress(stage, stage.marks.slice(0, i + 1).map((m) => m.tool))
  )

  return {
    output,
    details,
    reachedTools,
    gatesApplied: progress(stage, reachedTools).gatesApplied,
    progression: [...progression],
  }
})

/**
 * 便捷入口：从 Driver + Context 起一个 step 会话，再按 Stage 推进一直到 Result。
 * 等价于 `driver.start({ context })` 后 `runStaged(session, stage)`。
 */
export const runStagedDriver = <RD>(
  driver: Driver<RD>,
  context: Context,
  stage: Stage
): Effect.Effect<StagedResult, AgentError, RD> => Effect.gen(function*() {
  const driverSession = yield* driver.start({ context })
  const detailsRef = yield* Ref.make<ReadonlyArray<Detail>>([])
  const session = new Session(context, driverSession, detailsRef)
  return yield* runStaged(session, stage)
})
