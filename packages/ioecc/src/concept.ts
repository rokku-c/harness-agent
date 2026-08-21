import { Context, Effect, Schema } from "effect"

/**
 * IOECC —— 五个正交维度（纯抽象概念，无执行、无契约），effect-ts 化。
 *
 *   I (Input)         Agent 接收的数据形状
 *   O (Output)        Agent 产出给下游的数据形状
 *   E (Intent)        对世界的一次交互意图：在哪个 Connection 上做什么
 *   C (Connection)    世界：类型安全的服务接口（Context.Tag）
 *   C (Control)       对自身的控制实现（用具体 driver 能力写逻辑）
 *
 * 与 effect-ts 哲学对齐：
 *   - Connection 是 Context.Tag（类型安全的世界），不是裸 { name }
 *   - Agent 的 connections 声明它需要的世界（Requirement），运行时由 Effect 的 R 满足
 *   - Intent 是「对哪个 Connection 的交互」，驱动靠 driver 声明的 Control
 *   - 描述（Agent）与执行（Control.run）分离；Control.run 依赖走 Effect 环境
 */

/* ── E (Intent)：对世界的一次交互意图 ── */

/**
 * 对世界的交互意图：声明「对哪个 Connection 产生了可观测影响」。
 * `connection` 是 Connection Tag 的名字（必须被 Agent 声明过）。
 * 不携带操作契约——只是影响标记，后续可被访问/路由。
 */
export interface Intent<Connection extends string = string> {
  readonly _tag: string
  readonly connection: Connection
}

/* ── C (Connection)：世界（类型安全的服务接口） ── */

/**
 * 世界：Agent 连接的环境/容器。类型安全的服务接口（Context.Tag）。
 * 实现由外围 Layer 提供；Agent 只声明「我连接这个世界」。
 * 具体世界的服务类型由 Layer 提供时确定。
 */
export class Connection extends Context.Tag("IOECC/Connection")<Connection, unknown>() {}

/* ── 执行侧契约 ── */

/** Connection 实现：解释一个连接操作（操作契约在编译侧）。 */
export interface ConnectionImpl {
  readonly handle: (op: string, args: unknown) => Effect.Effect<unknown, Error>
}

/* ── C (Control)：对自身的控制实现 ── */

/**
 * 控制实现基类。用户继承它，写 constructor（构造）与 run（逻辑）。
 *
 * 关键：Control 声明它执行后影响哪些 connection（`affects`）——
 * 这是「声明影响」：执行这个 control 后，会对 affects 里的 connection 产生可观测影响，
 * 执行后获得绑定的 connection，可传给其他 driver/agent。
 *
 *   class WriteFile extends Control<In, Out> {
 *     constructor() { super("WriteFile", ["FileSystem"]) }  // 影响 FileSystem
 *     run(i, o): Effect<Out, Error> {
 *       return Effect.gen(function* () {
 *         // 经 affects 声明的 FileSystem connection 读写
 *         yield* ...
 *       })
 *     }
 *   }
 *
 * 静态 Trigger 与动态干预（Fork/Stop/Retry）都是 Control 的子类。
 * 影响声明绑定在 control 上，不绑在整个 agent 上。
 */
export class Control<I = unknown, O = unknown, R = never> {
  readonly _tag: string
  /** 执行这个 control 后影响哪些 connection（声明影响，供后续使用）。 */
  readonly affects: ReadonlyArray<string>
  constructor(_tag: string, affects: ReadonlyArray<string> = []) {
    this._tag = _tag
    this.affects = affects
  }
  /** 用 driver 能力写逻辑。执行后 affects 声明的 connection 经 impls 可访问。 */
  run(_i: I, _o: O, _impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error, R> {
    return Effect.fail(new Error(`Control ${this._tag} run not implemented`))
  }
}

/* ── Agent ── */

/**
 * Agent —— 被动黑盒（纯描述）。
 * 声明五个维度的形状。不执行；gen 注入 drivers，驱动靠 driver 声明的 Control。
 *
 * Driver 就是 Agent（五维度）：任何 Agent 都可以当 driver，递归。
 * `connections` 是 Agent 需要的世界的名字（Requirement 声明）；
 * 影响声明（affects）绑定在 Control 上，不绑在 Agent 上。
 */
export interface Agent<I = unknown, O = unknown, R = never> {
  readonly input: Schema.Schema<I>
  readonly output: Schema.Schema<O>
  /** 需要的世界的名字（Requirement 声明）。 */
  readonly connections: ReadonlyArray<string>
  readonly controls: ReadonlyArray<Control<any, any, any>>
  /** Drivers：声明时就绑定（n 个）。驱动靠 driver 声明的 control。 */
  readonly drivers: ReadonlyArray<Driver<any, any, any>>
}

/**
 * Driver —— 就是 Agent（五维度）。任何 Agent 都可以当 driver。
 * 核心不定义 Driver 的任何方法；具体 driver 是 Agent 实例，可附加自己的方法。
 */
export type Driver<I = unknown, O = unknown, R = never> = Agent<I, O, R>

/** 编译环境：Connection 实现。 */
export interface CompileEnv {
  readonly connections: ReadonlyMap<string, ConnectionImpl>
}
