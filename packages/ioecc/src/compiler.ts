import { Effect, Schema } from "effect"
import type { Agent, Connection, Control, Effect as EffectDecl } from "./concept.js"

/**
 * Compiler —— 把 Agent 描述变成可执行程序，并注入 Driver。
 *
 * 概念（concept.ts）是抽象声明；compile 提供两样执行侧契约：
 *   - Driver：能驱动这个 Agent 的执行者
 *   - Connections：如何解释 Agent 声明的每个 Effect
 *
 * Driver 也是 Agent 的形态：它遵循五维度（input/output 可 unknown），
 * connection 可以是 provider 适配。编译后的 agent 可以包装成 Driver，
 * 供其他 agent 使用（递归）。观测/额外功能 = Driver 提供的额外 Connection。
 */

/* ── Connection 实现 ── */

/** Connection 实现：解释一个 Effect（操作契约在编译侧）。 */
export interface ConnectionImpl {
  readonly handle: (effect: EffectDecl<any>) => Effect.Effect<unknown, Error>
}

/* ── Driver ── */

/**
 * Driver —— 能驱动一个 Agent 的执行者。
 * 本身遵循五维度：input/output 可 unknown；connection 是 provider 适配。
 * `run` 把输入喂给被驱动 agent，跑它的 effects/controls，产出 output。
 */
export interface Driver {
  readonly id: string
  /** 驱动：输入 → 输出。 */
  readonly run: (input: unknown) => Effect.Effect<unknown, Error>
  /** Driver 提供的额外 Connection（观测/日志/thinking 等）。 */
  readonly provides?: ReadonlyArray<Connection>
  /** Driver 支持的观测 Connection 实现。 */
  readonly observe?: ReadonlyMap<string, ConnectionImpl>
}

/* ── 编译环境 ── */

export interface CompileEnv {
  /** Driver：驱动这个 Agent。 */
  readonly driver: Driver
  /** Connection 实现：Agent 声明的每个 Effect 如何解释。 */
  readonly connections: ReadonlyMap<string, ConnectionImpl>
}

/* ── 解释 E / C ── */

/** 解释一个 E：按 connection 找实现。观测 Connection 由 driver 提供。 */
export const execute = (env: CompileEnv, effect: EffectDecl<any>) => {
  const impl = env.connections.get(effect.connection) ?? env.driver.observe?.get(effect.connection)
  if (!impl) return Effect.fail(new Error(`Unknown connection ${effect.connection}`))
  return impl.handle(effect)
}

/** 解释一个 C：驱动一次控制。经 Driver.run 执行（Driver 是执行者）。 */
export const drive = (env: CompileEnv, ctrl: Control, input: unknown) =>
  env.driver.run(input).pipe(
    Effect.mapError((cause) => new Error(`Driver failed on control ${ctrl._tag}: ${String(cause)}`))
  )

/* ── 任意 Agent 作 Driver ── */

/**
 * 把一个编译后的 Agent 包装成 Driver，供其他 Agent 使用。
 * 递归：组合 agent 加适配器 = 新 Driver。被驱动 agent 的 input/output 可 unknown。
 */
export const agentDriver = (
  compiled: { drive: (index: number, input: unknown) => Effect.Effect<unknown, Error> },
  options: { id?: string; observe?: ReadonlyMap<string, ConnectionImpl> } = {}
): Driver => ({
  id: options.id ?? "agent",
  run: (input) => compiled.drive(0, input),
  ...(options.observe ? { observe: options.observe } : {}),
})

/* ── compile ── */

/** 编译：把 Agent 描述 + Driver + Connection 实现 → 可运行程序。 */
export const compile = (agent: Agent<any, any>, env: CompileEnv) => ({
  /** 驱动一个静态触发器（controls[i]）。 */
  drive: (index: number, input: unknown) => {
    const ctrl = agent.controls[index]
    if (!ctrl) return Effect.fail(new Error(`No control at ${index}`))
    return drive(env, ctrl, input)
  },
  /** 直接执行一个 E（供外部按需调用）。 */
  execute: (effect: EffectDecl<any>) => execute(env, effect),
  /** 用 Agent 的 output Schema 解码最终输出。 */
  decode: (value: unknown) => Schema.decodeUnknown(agent.output)(value),
})
