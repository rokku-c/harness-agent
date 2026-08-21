import { Context, Effect, Schema } from "effect"

/**
 * IOECC —— 五个正交维度（纯概念，无执行）。
 *
 *   I (Input)         Agent 接收的数据
 *   O (Output)        Agent 产出给下游的数据
 *   E (Effect)        对世界的一次交互：在某个 Connection 上做一个操作
 *   C (Connection)    世界：Agent 连接的环境/容器（Context.Tag，只声明不 import）
 *   C (Control)       对自身的一次控制：静态 Trigger 或动态干预（Fork/Stop/Retry）
 *
 * E 和 C 是同一形状：都是「一个声明」。区别只在目标——
 * E 指向外部 Connection，C 指向自身运行。
 *
 * 核心不包含：具体 Trigger、Observability、Connection 实现（均由外围「长出来」）。
 */

/* ── E (Effect)：对世界的一次交互 ── */

/** 在某个 Connection 上做一个操作。`connection` 声明目标，`input`/`output` 是该操作的契约。 */
export interface Effect<
  Connection extends string = string,
  Input = unknown,
  Output = unknown,
> {
  readonly _tag: string
  readonly connection: Connection
  readonly input: Schema.Schema<Input>
  readonly output: Schema.Schema<Output>
}

/* ── C (Control)：对自身的一次控制 ── */

/** 对自身的一次控制。静态 Trigger 与动态干预共用此形状。 */
export interface Control<
  Input = unknown,
  Output = unknown,
> {
  readonly _tag: string
  readonly input: Schema.Schema<Input>
  readonly output: Schema.Schema<Output>
}

/* ── C (Connection)：世界 ── */

/**
 * 世界：Agent 连接的环境/容器。任何外部依赖（文件系统/API/资源）都抽象为一个 Tag。
 * 实现由外围提供；Agent 只声明「我连接这个 Connection」。
 */
export class Connection extends Context.Tag("Connection")<Connection, Record<string, never>>() {}

/* ── 解释器：把声明变成执行（运行时一侧，非五维度） ── */

/** 解释 E：把 Effect 路由到它声明的 Connection，返回类型安全结果。 */
export class EffectExecutor extends Context.Tag("EffectExecutor")<
  EffectExecutor,
  {
    readonly execute: (effect: Effect<any, any, any>) => Effect.Effect<unknown, Error>
  }
>() {}

/** 解释 C：驱动一次控制（静态 Trigger 或动态干预），返回类型安全结果。 */
export class ControlExecutor extends Context.Tag("ControlExecutor")<
  ControlExecutor,
  {
    readonly control: (control: Control<any, any>) => Effect.Effect<unknown, Error>
  }
>() {}

/* ── Agent ── */

/**
 * Agent —— 被动黑盒。
 * 声明两个维度：
 *   effects    这个 Agent 会产生哪些 E（影响哪些 Connection）
 *   controls   静态触发器集合（接受什么输入 + 触发后的行为）
 */
export interface Agent {
  readonly effects: ReadonlyArray<Effect<any, any, any>>
  readonly controls: ReadonlyArray<Control<any, any>>
}
