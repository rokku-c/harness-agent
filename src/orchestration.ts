import type { Until } from "./core.js"

/**
 * 执行编排：Stage / Until / Gates
 *
 * 让 agent 以「我们想要的方式」工作——推进到什么阶段、拿什么、什么可用。
 *
 *   Stage   推进路径（里程碑）
 *   Until   观察投影（见 core.ts：toolCall/schema/stop，可带阶段 at）
 *   Gates   解锁投影：到哪个阶段，世界变成什么样
 *
 * effect-ts 组合子表达，见 CORE_CONNECTION_PLAN 3.12。
 */

export type { Until }

/* ── Stage：推进路径 ── */

/** 推进路径：一串阶段标记，每个标记是「到达某工具调用」。 */
export interface Stage {
  readonly _tag: "Stage"
  readonly marks: ReadonlyArray<string>
}

export const Stage = {
  /** 第一步：到达某工具调用。 */
  guard: (tool: string): Stage => ({ _tag: "Stage", marks: [tool] })
}

/** 链式推进（pipe 友好）：stage.pipe(then("read_file"))。 */
export const then = (tool: string) => (stage: Stage): Stage => ({ _tag: "Stage", marks: [...stage.marks, tool] })

/* ── Gates：解锁投影（到哪个阶段，世界变成什么样） ── */

/** 工具可见/可用：show/hide 管可见，allow/deny 管可用。 */
export type ToolAccess = "show" | "hide" | "allow" | "deny"

export interface Gate {
  readonly at: number
  /** 变更持久指令（system prompt / 角色规则）。 */
  readonly always?: string
  /** 挂载容器 → 派生工具进 toolCall。 */
  readonly container?: ReadonlyArray<string>
  /** 挂载资源。 */
  readonly resource?: ReadonlyArray<string>
  /** 工具访问控制。 */
  readonly tools?: Readonly<Record<string, ToolAccess>>
}

export const Gate = {
  /** 到第 at 个阶段，应用 gate。 */
  at: (at: number, gate: Omit<Gate, "at">): Gate => ({ at, ...gate })
}
