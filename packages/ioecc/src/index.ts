import { Context, Effect, Schema } from "effect"

/**
 * IOECC —— 声明式 Agent 操作系统底座（核心：纯概念，无特殊结构）。
 *
 * 五个正交维度：
 *   I (Input)        Agent 接收的数据（由触发器提供）
 *   O (Output)       Agent 产出给下游的数据
 *   E (Effect)       对世界的交互意图（对外声明）
 *   C (Connection)   Agent 连接的世界/容器（Context.Tag，Agent 只声明不 import）
 *   C (Control)      对自身的控制意图（对内声明）
 *
 * 核心只定义概念的形状与关系：
 *   EffectIntent    对世界的交互（E），payload → result
 *   ControlIntent   对自身的控制（C），payload → result —— 与 EffectIntent 同构
 *   EffectExecutor  解释 E：路由到 Connection
 *   ControlExecutor 解释 C：驱动触发/生命周期/动态干预
 *   Agent           只有 controls（静态触发器集合），无 logic —— 逻辑属于被触发的那次运行
 *
 * Control 的两种形态（都是 ControlIntent，只是「在哪声明」不同）：
 *   - 静态 Trigger：声明期列在 Agent.controls 里
 *   - 动态 Control：运行期经 ControlExecutor.control() 声明（Fork/Stop/Retry）
 *
 * 不在核心（由外围实现「长出来」）：具体 Trigger、Observability（解释器内部切面）、Connection 实现。
 */

/* ────────────────────────── E / C：对偶声明 ────────────────────────── */

/** 对世界的交互意图（E）。Agent 构造它声明「我要在 Connection 上做什么」。 */
export interface EffectIntent<Payload, Result> {
  readonly _kind: "Effect"
  readonly _tag: string
  readonly payload: Payload
  readonly resultSchema: Schema.Schema<Result>
}

/**
 * 对自身的控制意图（C）。与 EffectIntent 同构。
 * 静态 Trigger 与动态 Control（Fork/Stop/Retry）共用这一形状。
 */
export interface ControlIntent<Payload, Result> {
  readonly _kind: "Control"
  readonly _tag: string
  readonly payload: Payload
  readonly resultSchema: Schema.Schema<Result>
}

/* ────────────────────────── 对偶解释器 ────────────────────────── */

/** 解释 E：把 EffectIntent 路由到 Connection，返回类型安全结果。 */
export class EffectExecutor extends Context.Tag("IOECC/EffectExecutor")<
  EffectExecutor,
  {
    readonly execute: <Payload, Result>(
      intent: EffectIntent<Payload, Result>
    ) => Effect.Effect<Result, Error>
  }
>() {}

/** 解释 C：驱动 ControlIntent（静态触发 / 动态干预），返回类型安全结果。 */
export class ControlExecutor extends Context.Tag("IOECC/ControlExecutor")<
  ControlExecutor,
  {
    readonly control: <Payload, Result>(
      intent: ControlIntent<Payload, Result>
    ) => Effect.Effect<Result, Error>
  }
>() {}

/* ────────────────────────── Agent ────────────────────────── */

/**
 * Agent —— 被动黑盒。
 * 只有 controls（静态触发器集合）。没有 logic：每个触发器携带「触发后的行为」，
 * 逻辑属于被触发的那一次运行，由解释器驱动。
 */
export interface Agent<R = never> {
  /** 静态触发器集合：声明「接受什么输入 + 触发后的行为」。 */
  readonly controls: ReadonlyArray<ControlIntent<any, any>>
}
