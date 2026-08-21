import { Context, Effect, Schema } from "effect"

/**
 * IOECC —— 五个正交维度（纯抽象概念，无执行、无契约）。
 *
 *   I (Input)         单个 Control 接收的数据形状（I/O 定义在 Control 上）
 *   O (Output)        单个 Control 产出给下游的数据形状
 *   E (Effect)        对世界的影响声明：Control 执行后影响哪些 Connection
 *   C (Connection)    世界：Agent 需要的环境（名字声明）
 *   C (Control)       对自身的控制实现（用具体 driver 能力写逻辑）
 *
 * 与 effect-ts 哲学对齐：
 *   - I/O 定义在 Control 上，不绑在 Agent 上；Agent 是 connections + controls 的组合
 *   - 影响声明（affects）在 Control 上，执行后经 impls 访问影响的 Connection
 *   - 描述（Agent/Control）与执行（Control.run）分离
 */

/* ── C (Connection)：世界 ── */

/**
 * 世界：Agent 连接的环境/容器。实现由外围提供；Agent 只声明名字。
 */
export interface Connection {
  readonly name: string
}

/* ── Connection 实现（执行侧契约） ── */

/** Connection 实现：解释一个连接操作（操作契约在编译侧）。 */
export interface ConnectionImpl {
  readonly handle: (op: string, args: unknown) => Effect.Effect<unknown, Error>
}

/* ── C (Control)：对自身的控制实现 ── */

/**
 * 控制实现基类。用户继承它，声明 I/O + 影响，写 run 逻辑。
 *
 *   class WriteFile extends Control<{ path: string; data: string }, string> {
 *     readonly input = Schema.Struct({ path: Schema.String, data: Schema.String })  // 这个 control 的输入
 *     readonly output = Schema.String                                              // 这个 control 的输出
 *     constructor() { super("WriteFile", ["FileSystem"]) }                          // 影响 FileSystem
 *     run(i, impls): Effect<string, Error> {                                        // 逻辑
 *       const fs = impls.get("FileSystem")!
 *       return fs.handle("write", i) as Effect<string, Error>
 *     }
 *   }
 *
 * 静态 Trigger 与动态干预（Fork/Stop/Retry）都是 Control 的子类。
 * I/O 和影响都定义在 Control 上，不绑在 Agent 上。
 */
export class Control<I = unknown, O = unknown, R = never> {
  readonly _tag: string
  /** 这个 control 影响哪些 connection（声明影响，供后续使用）。 */
  readonly affects: ReadonlyArray<string>
  constructor(_tag: string, affects: ReadonlyArray<string> = []) {
    this._tag = _tag
    this.affects = affects
  }
  /** 这个 control 的输入形状（子类声明）。 */
  declare readonly input: Schema.Schema<I>
  /** 这个 control 的输出形状（子类声明）。 */
  declare readonly output: Schema.Schema<O>
  /** 逻辑：接收输入，经 impls 访问影响的 connection。 */
  run(_i: I, _impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error, R> {
    return Effect.fail(new Error(`Control ${this._tag} run not implemented`))
  }
}

/* ── Agent ── */

/**
 * Agent —— 被动黑盒（纯描述）。
 * 由 connections（需要的世界）+ controls（控制集合）组成。
 * I/O 定义在 Control 上；Agent 的整体 I/O 是各 Control 的组合。
 *
 * Driver 就是 Agent：任何 Agent 都可以当 driver，递归。
 */
export interface Agent<R = never> {
  /** 需要的世界的名字。 */
  readonly connections: ReadonlyArray<string>
  /** 控制集合（每个 Control 自带 I/O + affects）。 */
  readonly controls: ReadonlyArray<Control<any, any, any>>
  /** Drivers：声明时就绑定（n 个）。驱动靠 driver 声明的 control。 */
  readonly drivers: ReadonlyArray<Driver<any>>
}

/**
 * Driver —— 就是 Agent。任何 Agent 都可以当 driver。
 * 核心不定义 Driver 的任何方法；具体 driver 是 Agent 实例，可附加自己的方法。
 */
export type Driver<R = never> = Agent<R>
