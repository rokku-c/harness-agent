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

/* ── C (Control)：对自身的控制声明 ── */

/**
 * 抽象的控制声明：对自身运行的一次控制。
 * 不携带操作契约；静态 Trigger 与动态干预（Fork/Stop/Retry）的区分由外围决定。
 */
export interface Control {
  readonly _tag: string
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
 * 描述不执行；compile（compiler.ts）把描述变成可运行程序，并注入 Driver。
 *
 * Driver 也是 Agent 的形态：它遵循同一五维度（input/output 可 unknown，
 * connection 是 provider 适配）。任意编译后的 agent 可包装成 Driver，
 * 供其他 agent 使用（递归）。观测/额外功能 = Driver 提供的额外 Connection。
 */
export interface Agent<I = unknown, O = unknown> {
  readonly input: Schema.Schema<I>
  readonly output: Schema.Schema<O>
  readonly effects: ReadonlyArray<Effect<any>>
  readonly connections: ReadonlyArray<Connection>
  readonly controls: ReadonlyArray<Control>
  /** Driver：声明时就绑定，gen 里可用 driver 的能力写控制逻辑。 */
  readonly driver: Driver
}

/* ── 执行侧契约类型（compile 时提供；放这里避免 gen/compiler 循环依赖） ── */

/** Connection 实现：解释一个 Effect（操作契约在编译侧）。 */
export interface ConnectionImpl {
  readonly handle: (effect: Effect<any>) => Effect.Effect<unknown, Error>
}

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

/** 编译环境：Connection 实现。driver 已在 Agent 上绑定。 */
export interface CompileEnv {
  /** Connection 实现：Agent 声明的每个 Effect 如何解释。 */
  readonly connections: ReadonlyMap<string, ConnectionImpl>
}
