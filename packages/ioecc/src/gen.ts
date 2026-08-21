import { Effect, Schema } from "effect"
import type { Agent, Connection, ConnectionImpl, Control, Driver, Effect as EffectDecl } from "./concept.js"

/**
 * gen 引擎 —— 五维度 + driver 作入参，function* 写触发逻辑（gen 就是 compile）。
 *
 * 不再 yield 描述操作；五维度（input/output/effects/connections/controls）和 driver
 * 直接作为参数传入，function* 是「触发后的控制逻辑」（接收输入，产出输出）。
 *
 *   const program = EffectAgent.gen({
 *     input: Schema.String,
 *     output: Schema.String,
 *     effects: [{ _tag: "Echo", connection: "Echo" }],
 *     connections: [{ name: "Echo" }],
 *     controls: [{ _tag: "OnInput" }],
 *   }, driver, (input) => driver.run(input))
 *
 * 产出 Program：直接 drive/execute。driver 已绑定，connections 提供 Effect 实现。
 */

/** 编译后的可运行程序（含描述，供外部查看/观测）。 */
export interface Program {
  /** 该程序的 Agent 描述（可读：effects/connections/controls）。 */
  readonly agent: Agent<any, any>
  readonly drive: (index: number, input: unknown) => Effect.Effect<unknown, Error>
  readonly execute: (effect: EffectDecl<any>) => Effect.Effect<unknown, Error>
  readonly decode: (value: unknown) => Effect.Effect<unknown, Error>
}

/** 五维度描述 + driver 的完整规格。 */
export interface AgentSpec<I = unknown, O = unknown> {
  readonly input: Schema.Schema<I>
  readonly output: Schema.Schema<O>
  readonly effects: ReadonlyArray<EffectDecl<any>>
  readonly connections: ReadonlyArray<Connection>
  readonly controls: ReadonlyArray<Control>
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

/**
 * gen —— 五维度 + driver 作入参，产出可运行程序。
 * @param spec 五维度描述
 * @param driver 执行者（绑定在 agent 上）
 * @param impls Connection 实现（Effect 如何解释）
 * @param logic 可选的触发逻辑（function*：接收输入 → 产出输出；缺省走 driver.run）
 */
export const gen = <I, O>(
  spec: AgentSpec<I, O>,
  driver: Driver,
  impls: ReadonlyMap<string, ConnectionImpl> = new Map(),
  logic?: (input: I) => Effect.Effect<O, Error>
): Program => {
  const program = toProgram(spec, driver, impls)
  // 若有自定义触发逻辑，用它包一层 drive。
  return logic
    ? { ...program, drive: (index, input) => logic(input as I) as Effect.Effect<unknown, Error> }
    : program
}

/** 元编程构造：五维度 + driver + connections → 可运行程序。 */
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

/** EffectAgent 命名空间。 */
export const EffectAgent = {
  gen,
  make,
}
