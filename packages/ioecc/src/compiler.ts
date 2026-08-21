import { Effect, Schema } from "effect"
import type { Agent, Connection, Control, Effect as EffectDecl } from "./concept.js"

/**
 * Compiler —— 把 Agent 描述变成可执行程序。
 *
 * 概念（concept.ts）是抽象声明（哪个 Connection 受影响），不携带操作契约。
 * compile 时提供「契约」：每个 Connection 实现如何解释针对它的 Effect。
 */

/** Connection 实现：解释一个 Effect（具体操作契约在这里，不在核心）。 */
export interface ConnectionImpl {
  readonly handle: (effect: EffectDecl<any>) => Effect.Effect<unknown, Error>
}

/** 编译环境：Connection 名 → 真实实现。 */
export interface CompileEnv {
  readonly connections: ReadonlyMap<string, ConnectionImpl>
}

/** 解释一个 E：按 connection 找实现，执行。 */
export const execute = (env: CompileEnv, effect: EffectDecl<any>) => {
  const impl = env.connections.get(effect.connection)
  if (!impl) return Effect.fail(new Error(`Unknown connection ${effect.connection}`))
  return impl.handle(effect)
}

/** 解释一个 C：驱动一次控制（具体行为由外围 handle 提供）。 */
export const drive = (env: CompileEnv, ctrl: Control, input: unknown) => {
  // Control 的具体行为契约不在核心；compile 时通过 env 提供。
  // 这里用一个可选的 handle 约定：Control 若携带 handle，则驱动它。
  const h = (ctrl as Control & { handle?: (i: unknown) => Effect.Effect<unknown, Error> }).handle
  if (!h) return Effect.fail(new Error(`No handle on control ${ctrl._tag}`))
  return h(input)
}

/** 编译：把 Agent 描述 + Connection 实现 → 可运行程序。 */
export const compile = (agent: Agent<any, any>, env: CompileEnv) => ({
  /** 驱动一个静态触发器（controls[i]）。 */
  drive: (index: number, input: unknown) => {
    const ctrl = agent.controls[index]
    if (!ctrl) return Effect.fail(new Error(`No control at ${index}`))
    return drive(env, ctrl, input)
  },
  /** 直接执行一个 E（供外部按需调用）。 */
  execute: (effect: EffectDecl<any>) => execute(env, effect),
})
