import { Context, Effect, Schema } from "effect"
import type { Agent, Control, Effect as EffectDecl } from "./concept.js"

/**
 * Compiler —— 把 Agent 描述变成可执行程序。
 *
 * 核心（concept.ts）只含描述，不执行。这里接收：
 *   - Agent 描述（effects + controls）
 *   - Connection 实现（如何解释每个 Effect 的 connection）
 *
 * 产出可运行的 Effect 程序。
 */

/** Connection 实现：解释一个 Effect（按 connection 路由 + Schema 解码）。 */
export interface ConnectionImpl {
  readonly handle: (effect: EffectDecl<any, any, any>) => Effect.Effect<unknown, Error>
}

/** 编译环境：Agent 描述的 connection 名 → 真实实现。 */
export interface CompileEnv {
  readonly connections: ReadonlyMap<string, ConnectionImpl>
}

/** 解释一个 E：路由到它声明的 Connection，用 output Schema 解码。 */
export const execute = (env: CompileEnv, effect: EffectDecl<any, any, any>) => {
  const conn = env.connections.get(effect.connection)
  if (!conn) return Effect.fail(new Error(`Unknown connection ${effect.connection}`))
  return conn.handle(effect).pipe(
    Effect.flatMap((raw) => Schema.decodeUnknown(effect.output)(raw).pipe(
      Effect.mapError((cause) => new Error(`Output mismatch on ${effect._tag}: ${cause}`))
    ))
  )
}

/** 解释一个 C：驱动一次控制（静态 Trigger 的 handle）。 */
export const control = (env: CompileEnv, ctrl: Control<any, any>, input: unknown) => {
  // 用 input Schema 解码，再交给 handle。
  return Schema.decodeUnknown(ctrl.input)(input).pipe(
    Effect.mapError((cause) => new Error(`Input mismatch on ${ctrl._tag}: ${cause}`)),
    Effect.flatMap((decoded) => {
      // Control 的「行为」由外围 handle 提供；核心只保证解码。
      // 这里通过一个可选的 handle 字段驱动（若 Control 携带）。
      const h = (ctrl as Control<any, any> & { handle?: (i: any) => Effect.Effect<any, Error> }).handle
      if (!h) return Effect.fail(new Error(`No handle on ${ctrl._tag}`))
      return h(decoded)
    })
  )
}

/** 编译：把 Agent 描述 + Connection 实现 → 可运行程序（每个静态触发器的入口）。 */
export const compile = (agent: Agent, env: CompileEnv) => ({
  /** 驱动一个静态触发器（controls[i]）。 */
  drive: (index: number, input: unknown) => {
    const ctrl = agent.controls[index]
    if (!ctrl) return Effect.fail(new Error(`No control at ${index}`))
    return control(env, ctrl, input)
  },
  /** 直接执行一个 E（供外部按需调用）。 */
  execute: (effect: EffectDecl<any, any, any>) => execute(env, effect),
})
