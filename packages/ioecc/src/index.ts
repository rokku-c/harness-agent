import { Context, Effect, Layer, PubSub, Scope, Schema, Stream } from "effect"

/**
 * IOECC —— 声明式 Agent 操作系统底座（单文件核心）。
 *
 * 概念（全部在这一个文件里，拓扑/触发器由 Connection 实现「长出来」）：
 *
 *   DeclaredEffect    对世界的交互意图（带目标 connection + outputSchema）
 *   DeclaredControl   对自身的控制意图（带 inputSchema + outputSchema）
 *   EffectExecutor    解释 Effect：路由到 Connection，Schema 解码结果
 *   ControlExecutor   解释 Control：Schema 解码输入 → 驱动 run
 *   Observability     统一可观测世界：一切声明与结果汇聚，可订阅
 *   ControlRunner     触发器绑定输入类型（类型闭合的关键）
 *   Agent             声明集合（controls）+ 存在性约束（NotAllVoid）
 *
 * Agent 不做执行，只做声明；触发、路由、副作用、可观测全部由解释器 + 可观测世界接管。
 */

/* ────────────────────────── 对偶声明 ────────────────────────── */

/**
 * 对世界的交互意图。
 * `connection` 指定目标 Connection（Executor 据此路由）；`outputSchema` 提供运行时解码。
 */
export interface DeclaredEffect<Out> {
  readonly _kind: "Effect"
  readonly _tag: string
  readonly connection: string
  readonly outputSchema: Schema.Schema<Out>
}

/**
 * 对自身的控制意图。与 DeclaredEffect 对称，但控制有输入（inputSchema 供解码）。
 */
export interface DeclaredControl<In, Out> {
  readonly _kind: "Control"
  readonly _tag: string
  readonly inputSchema: Schema.Schema<In>
  readonly outputSchema: Schema.Schema<Out>
}

/* ────────────────────────── 对偶解释器 ────────────────────────── */

/** 解释 Effect：路由到 Connection，返回类型安全结果。 */
export class EffectExecutor extends Context.Tag("IOECC/EffectExecutor")<
  EffectExecutor,
  {
    readonly execute: <Out>(effect: DeclaredEffect<Out>) => Effect.Effect<Out, Error>
  }
>() {}

/** 解释 Control：用 inputSchema 解码输入 → 驱动 run，返回类型安全结果。 */
export class ControlExecutor extends Context.Tag("IOECC/ControlExecutor")<
  ControlExecutor,
  {
    readonly control: <In, Out, R>(
      control: DeclaredControl<In, Out>,
      input: In,
      run: (input: In) => Effect.Effect<Out, Error, R>
    ) => Effect.Effect<Out, Error, R>
  }
>() {}

/* ────────────────────────── 可观测世界 ────────────────────────── */

export type Observation =
  | { readonly _tag: "Effect"; readonly effect: DeclaredEffect<unknown>; readonly result: unknown }
  | { readonly _tag: "Control"; readonly control: DeclaredControl<unknown, unknown>; readonly result: unknown }

/** 统一可观测世界：接收所有声明及结果，可订阅（监督/日志/时间旅行）。 */
export class Observability extends Context.Tag("IOECC/Observability")<
  Observability,
  {
    readonly record: (event: Observation) => Effect.Effect<void>
    readonly subscribe: Effect.Effect<Stream.Stream<Observation>, never, Scope.Scope>
  }
>() {}

/* ────────────────────────── ControlRunner + Agent ────────────────────────── */

/**
 * ControlRunner —— 触发器绑定输入类型（类型闭合的关键）。
 * 每个触发器自带专属的 run 逻辑，输入类型 I 由 trigger.inputSchema 确定，
 * 不会在多触发器场景被「联合类型」压平。
 */
export interface ControlRunner<In, Out, R = never> {
  readonly trigger: DeclaredControl<In, Out>
  readonly run: (input: In) => Effect.Effect<Out, Error, R>
}

/** 从 ControlRunner 数组提取输入类型联合。 */
export type InputOf<C> = C extends ControlRunner<infer I, any, any> ? I : never
/** 从 ControlRunner 数组提取输出类型联合。 */
export type OutputOf<C> = C extends ControlRunner<any, infer O, any> ? O : never

/** 存在性约束：I、O、E 至少一个非 void，否则类型崩塌为 never（杜绝死节点）。 */
export type NotAllVoid<I, O, E> = [I] extends [void]
  ? [O] extends [void]
    ? [E] extends [void] ? never : true
    : true
  : true

/**
 * Agent —— 声明集合（被动黑盒）。
 * 泛型 E 是该 agent 能声明的 Effect 联合；C 是 ControlRunner 数组；R 是运行时依赖。
 * 触发与运行完全由外部 ControlExecutor 驱动，Agent 只陈述「当 Control 触发时如何处理输入」。
 */
export interface Agent<
  E extends DeclaredEffect<any>,
  C extends readonly ControlRunner<any, any, any>[],
  R = never
> {
  /** 存在性约束落位：全为 void 时无法实例化。 */
  readonly __existence: NotAllVoid<InputOf<C[number]>, OutputOf<C[number]>, E>
  /** 触发器集合：决定启动入口与输入来源。 */
  readonly controls: C
}

/**
 * 构造一个 Agent。
 * 注意：存在性约束在「用 Agent<E, C, R> 类型标注」时由编译器解析（C 已知）强制；
 * makeAgent 泛型化时 C 未定，无法在构造点解析，约束在标注点生效。
 */
export const makeAgent = <
  E extends DeclaredEffect<any>,
  C extends readonly ControlRunner<any, any, any>[],
  R = never
>(agent: { readonly controls: C }): Agent<E, C, R> =>
  ({ __existence: true, controls: agent.controls }) as unknown as Agent<E, C, R>

/* ────────────────────────── 缺省实现（可观测 + 透传） ────────────────────────── */

/** 基于 PubSub 的可观测世界（缺省实现）。 */
export const observabilityLayer = Layer.effect(
  Observability,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<Observation>()
    return {
      record: (event: Observation) => PubSub.publish(pubsub, event),
      subscribe: Stream.fromPubSub(pubsub, { scoped: true }),
    }
  })
)

/** 缺省解释器：Effect 未知连接即失败（由 Connection 覆盖）；Control 透传解码→run（核心驱动机制）。 */
export const defaultExecutors = Layer.merge(
  Layer.effect(EffectExecutor, Effect.succeed({
    execute: <Out>(effect: DeclaredEffect<Out>) =>
      Effect.fail(new Error(`No handler for effect ${effect._tag}@${effect.connection}`)),
  })),
  Layer.effect(ControlExecutor, Effect.succeed({
    control: <In, Out, R>(
      control: DeclaredControl<In, Out>,
      input: In,
      run: (input: In) => Effect.Effect<Out, Error, R>
    ) => Effect.gen(function* () {
      // 用 inputSchema 解码输入（物理类型保障），再驱动 run。
      const decoded = yield* Schema.decodeUnknown(control.inputSchema)(input).pipe(
        Effect.mapError((cause) => new Error(`Control input schema mismatch: ${cause}`))
      )
      return yield* run(decoded)
    }),
  }))
)
