import type { Until } from "./core.js"

/**
 * 执行编排：Stage / Until / Gates
 *
 * 让 agent 以「我们想要的方式」工作——推进到什么阶段、拿什么、什么可用。
 *
 *   Stage   推进路径（里程碑，每个节点自带解锁配置）
 *   Until   观察投影（见 core.ts：toolCall/schema/stop）
 *
 * effect-ts 组合子表达，见 DESIGN。
 */

export type { Until }

/* ── Gate：阶段解锁配置 ── */

/** 工具可见/可用：show/hide 管可见，allow/deny 管可用。 */
export type ToolAccess = "show" | "hide" | "allow" | "deny"

export interface Gate {
  /** 变更持久指令（system prompt / 角色规则）。 */
  readonly always?: string
  /** 挂载容器 → 派生工具进 toolCall。 */
  readonly container?: ReadonlyArray<string>
  /** 挂载资源。 */
  readonly resource?: ReadonlyArray<string>
  /** 工具访问控制。 */
  readonly tools?: Readonly<Record<string, ToolAccess>>
}

/* ── Stage：推进路径（每个节点自带 Gate） ── */

/** 推进路径：一串阶段，每个是「到达某工具调用」+ 解锁配置。 */
export interface Stage {
  readonly _tag: "Stage"
  readonly marks: ReadonlyArray<{ readonly tool: string; readonly gate?: Gate }>
}

export const Stage = {
  /** 第一步：到达某工具调用，可带解锁配置。 */
  guard: (tool: string, gate?: Gate): Stage => ({ _tag: "Stage", marks: [{ tool, gate }] })
}

/** 链式推进：在当前 stage 上追加下一个工具调用（可带解锁配置）。 */
export const then = (tool: string, gate?: Gate) => (stage: Stage): Stage => ({
  _tag: "Stage",
  marks: [...stage.marks, { tool, gate }],
})

/** 兼容旧 API：从 Stage 取出所有 gate。 */
export const gatesOf = (stage: Stage): ReadonlyArray<Gate> =>
  stage.marks.flatMap((mark) => mark.gate ? [mark.gate] : [])

/** 兼容旧 API：从 Stage 取出推进路径（工具名列表）。 */
export const toolsOf = (stage: Stage): ReadonlyArray<string> => stage.marks.map((mark) => mark.tool)
