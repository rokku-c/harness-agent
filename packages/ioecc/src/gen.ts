import { Effect, Schema } from "effect"
import type { Agent, Connection, ConnectionImpl, Control, Driver, Effect as EffectDecl } from "./concept.js"

/**
 * IOECC —— 声明 + 控制实现两步。
 *
 * 1. 声明：EffectAgent（五维度 + driver）—— 纯声明，不执行。
 *    const agent = EffectAgent.gen({ input, output, effects, connections, controls }, driver)
 *
 * 2. 控制实现：Control.run(spec, driver) —— 用 driver 的能力写真实逻辑。
 *    const program = Control.run(agent, driver)  // → Effect<A, E, R>
 *      内：yield* d.SetProvider(...) / yield* d.run(...)
 *
 * Control 是「用 driver 写的一段 Effect 逻辑」，不是标签。
 * 声明（五维度）与实现（Control.run）分离：声明可序列化，实现才执行。
 */

/** 五维度描述。 */
export interface AgentSpec<I = unknown, O = unknown> {
  readonly input: Schema.Schema<I>
  readonly output: Schema.Schema<O>
  readonly effects: ReadonlyArray<EffectDecl<any>>
  readonly connections: ReadonlyArray<Connection>
  readonly controls: ReadonlyArray<Control>
}

/** 编译后的可运行程序（含描述，供外部查看/观测）。 */
export interface Program {
  /** 该程序的 Agent 描述（可读：effects/connections/controls）。 */
  readonly agent: Agent<any, any>
  readonly drive: (index: number, input: unknown) => Effect.Effect<unknown, Error>
  readonly execute: (effect: EffectDecl<any>) => Effect.Effect<unknown, Error>
  readonly decode: (value: unknown) => Effect.Effect<unknown, Error>
}

/** 解释一个 E：按 connection 找实现。观测 Connection 由 driver 提供。 */
const execute = (agent: Agent<any, any>, connections: ReadonlyMap<string, ConnectionImpl>, effect: EffectDecl<any>) => {
  const impl = connections.get(effect.connection) ?? agent.driver.observe?.get(effect.connection)
  if (!impl) return Effect.fail(new Error(`Unknown connection ${effect.connection}`))
  return impl.handle(effect)
}

/** 解释一个 C：驱动一次控制。经 Driver.run 执行（Driver 是执行者，绑定在 agent 上）。 */
const drive = (agent: Agent<any, any>, ctrl: Control, input: unknown) =>
  agent.driver.run(input).pipe(
    Effect.mapError((cause) => new Error(`Driver failed on control ${ctrl._tag}: ${String(cause)}`))
  )

/** 把 AgentSpec 变成可运行程序。 */
const toProgram = (spec: AgentSpec<any, any>, driver: Driver, connections: ReadonlyMap<string, ConnectionImpl>): Program => {
  const agent: Agent<any, any> = { ...spec, driver }
  return {
    agent,
    drive: (index, input) => {
      const ctrl = agent.controls[index]
      if (!ctrl) return Effect.fail(new Error(`No control at ${index}`))
      return drive(agent, ctrl, input)
    },
    execute: (effect) => execute(agent, connections, effect),
    decode: (value) => Schema.decodeUnknown(agent.output)(value),
  }
}

/* ── 声明：EffectAgent ── */

/**
 * gen —— 声明五维度 + driver。纯声明，不执行。
 */
export const gen = <I, O>(
  spec: AgentSpec<I, O>,
  driver: Driver,
  impls: ReadonlyMap<string, ConnectionImpl> = new Map()
): Program => toProgram(spec, driver, impls)

/** 元编程构造：五维度 + driver → 可运行程序。 */
export const make = <I, O, E extends EffectDecl<any>, Cn extends Connection, Ct extends Control>(
  spec: {
    readonly input: Schema.Schema<I>
    readonly output: Schema.Schema<O>
    readonly effects: ReadonlyArray<E>
    readonly connections: ReadonlyArray<Cn>
    readonly controls: ReadonlyArray<Ct>
  },
  driver: Driver,
  impls: ReadonlyMap<string, ConnectionImpl> = new Map()
): Program => toProgram(spec as AgentSpec<I, O>, driver, impls)

/* ── 控制实现：Control.run（用 driver 写逻辑） ── */

/**
 * ControlImpl —— 控制实现。
 * `run(program, d, logic)` 接收 gen 产出的 Program + driver + 逻辑生成器；
 * 生成器内用 `yield* d.xxx()` 编排（SetProvider 配置 / run 驱动）。
 * 用 Effect.gen 驱动生成器（yield* 解包 Effect）。
 */
export const ControlImpl = {
  run: <A, E = Error, R = never>(
    _program: Program,
    _d: Driver,
    logic: (d: Driver) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R> => logic(_d),
}

/** EffectAgent 命名空间（声明）。 */
export const EffectAgent = {
  gen,
  make,
}
