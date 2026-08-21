import { Effect, Schema } from "effect"

/**
 * IOECC —— 五个正交维度（纯抽象概念，无执行、无契约）。
 *
 *   I (Input)         Agent 接收的数据形状
 *   O (Output)        Agent 产出给下游的数据形状
 *   E (Effect)        对世界的影响声明：哪个 Connection 的外部受影响
 *   C (Connection)    世界：Agent 连接的环境/容器（抽象边界，非运行时实现）
 *   C (Control)       对自身的控制声明：静态 Trigger 或动态干预（Fork/Stop/Retry）
 *
 * 这里的每个概念都是「描述」，不执行、不携带操作契约。
 * 具体契约（如何执行一个 Effect、如何驱动一个 Control）在 compile 时提供。
 */

/* ── E (Effect)：对世界的影响声明 ── */

/**
 * 抽象的影响声明：只声明「对哪个 Connection 的外部产生了可观测的影响」。
 * 不携带操作契约（input/output）——那是具体操作的事；E 只是影响标记，后续可被访问/路由。
 */
export interface Effect<Connection extends string = string> {
  readonly _tag: string
  readonly connection: Connection
}

/* ── C (Control)：对自身的控制实现 ── */

/**
 * 控制实现基类。用户继承它，写 constructor（构造）与 run（逻辑）。
 *
 *   class OnInput extends Control<I, O> {
 *     constructor(...) { super(...) }        // 构造
 *     run(I, O, E, Cn, Ct, d) {              // 用 driver 写逻辑
 *       return Effect.gen(function* () {
 *         yield* d.run(...)
 *       })
 *     }
 *   }
 *
 * 静态 Trigger 与动态干预（Fork/Stop/Retry）都是 Control 的子类。
 */
export class Control<I = unknown, O = unknown> {
  readonly _tag: string
  constructor(_tag: string) { this._tag = _tag }
  /** 用 driver 写逻辑：接收五维度 + driver，返回 Effect。子类可自由 override。 */
  run(
    _i: I,
    _o: O,
    _effects: ReadonlyArray<Effect<any>>,
    _connections: ReadonlyArray<Connection>,
    _controls: ReadonlyArray<Control>,
    _d: Driver
  ): Effect.Effect<O, Error> {
    return Effect.fail(new Error(`Control ${this._tag} run not implemented`))
  }
}

/* ── C (Connection)：世界 ── */

/**
 * 世界：Agent 连接的环境/容器（抽象边界）。
 * 只声明「存在一个叫 name 的世界」；实现由外围提供。
 */
export interface Connection {
  readonly name: string
}

/* ── Agent ── */

/**
 * Agent —— 被动黑盒（纯描述）。
 * 声明五个维度的形状：
 *   input        接收什么（I）
 *   output       产出什么（O）
 *   effects      影响哪些 Connection（E）
 *   connections  连接哪些世界（C）
 *   controls     哪些控制（C）
 *
 * 描述不执行；gen（gen.ts）注入 driver（可以有 n 个），驱动靠 driver 声明的 control。
 *
 * Driver 就是 Agent（五维度）：任何 Agent 都可以当 driver，递归。
 */
export interface Agent<I = unknown, O = unknown> {
  readonly input: Schema.Schema<I>
  readonly output: Schema.Schema<O>
  readonly effects: ReadonlyArray<Effect<any>>
  readonly connections: ReadonlyArray<Connection>
  readonly controls: ReadonlyArray<Control>
  /** Drivers：声明时就绑定（n 个）。驱动靠 driver 声明的 control。 */
  readonly drivers: ReadonlyArray<Driver>
}

/* ── 执行侧契约类型（compile 时提供；放这里避免 gen/compiler 循环依赖） ── */

/** Connection 实现：解释一个 Effect（操作契约在编译侧）。 */
export interface ConnectionImpl {
  readonly handle: (effect: Effect<any>) => Effect.Effect<unknown, Error>
}

/**
 * Driver —— 就是 Agent（五维度）。任何 Agent 都可以当 driver。
 *
 * 核心不定义 Driver 的任何方法（无 run/SetProvider/observe）。
 * 具体 driver（如 claude code driver）是一个 Agent，五维度填 provider 适配，
 * 它内部可能有很多方法（run/SetProvider 等），但那是具体 driver 自己的，非核心强制。
 *
 * 观测/额外功能：具体 driver 作为 Connection 提供（外部可访问）。
 */
export type Driver<I = unknown, O = unknown> = Agent<I, O>

/** 编译环境：Connection 实现。driver 已在 Agent 上绑定。 */
export interface CompileEnv {
  /** Connection 实现：Agent 声明的每个 Effect 如何解释。 */
  readonly connections: ReadonlyMap<string, ConnectionImpl>
}
