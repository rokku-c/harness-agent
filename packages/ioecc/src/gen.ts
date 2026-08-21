import { Effect, Schema } from "effect"
import { Control } from "./concept.js"
import type { Agent, Connection, ConnectionImpl, Driver, Effect as EffectDecl } from "./concept.js"

/**
 * IOECC —— 声明（五维度）+ 驱动（driver 声明的 control）。
 *
 * driver 就是 Agent（五维度），可以有 n 个。驱动不靠 driver.run，
 * 而靠 driver 声明的 controls（每个 control 是 Control 实现，用具体 driver 能力写逻辑）。
 *
 *   const driver = { ...五维度..., controls: [myControl] }   // driver 声明 control
 *   const agent = EffectAgent.gen({ ...五维度... }, driver)  // driver 作为 agent
 *   const out = yield* agent.drive(0, input)                  // 驱动：执行 driver 的 control
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

/** 解释一个 E：按 connection 找实现。 */
const execute = (agent: Agent<any, any>, connections: ReadonlyMap<string, ConnectionImpl>, effect: EffectDecl<any>) => {
  const impl = connections.get(effect.connection)
  if (!impl) return Effect.fail(new Error(`Unknown connection ${effect.connection}`))
  return impl.handle(effect)
}

/** 解释一个 C：驱动一次控制。经 Control.run 执行（Control 实现用 driver 能力写逻辑）。 */
const drive = (agent: Agent<any, any>, ctrl: Control, input: unknown) =>
  ctrl.run(
    input,
    agent.output as never,
    agent.effects,
    agent.connections,
    agent.controls,
    agent.drivers[0]!
  ).pipe(
    Effect.mapError((cause) => new Error(`Control ${ctrl._tag} failed: ${String(cause)}`))
  )

/** 把 AgentSpec 变成可运行程序。 */
const toProgram = (spec: AgentSpec<any, any>, drivers: ReadonlyArray<any>, connections: ReadonlyMap<string, ConnectionImpl>): Program => {
  const agent: Agent<any, any> = { ...spec, drivers }
  // 声明一致性：每个 effect 指向的 connection 必须被声明过，否则报错。
  const declaredConnections = new Set((spec.connections ?? []).map((c) => c.name))
  for (const effect of spec.effects ?? []) {
    if (!declaredConnections.has(effect.connection))
      throw new Error(`Effect ${effect._tag} declares connection "${effect.connection}" but it's not in connections: [${[...declaredConnections].join(", ")}]`)
  }
  // 所有 control：agent 自己声明的 + 各 driver 声明的（驱动靠 driver 的 control）。
  const allControls = [...(spec.controls ?? []), ...drivers.flatMap((d: any) => d.controls ?? [])]
  return {
    agent,
    drive: (index, input) => {
      const ctrl = allControls[index]
      if (!ctrl) return Effect.fail(new Error(`No control at ${index}`))
      return drive(agent, ctrl, input)
    },
    execute: (effect) => execute(agent, connections, effect),
    decode: (value) => Schema.decodeUnknown(agent.output)(value),
  }
}

/** 声明：五维度 + drivers（可以有 n 个）。 */
export const gen = <I, O>(
  spec: AgentSpec<I, O>,
  drivers: ReadonlyArray<any>,
  impls: ReadonlyMap<string, ConnectionImpl> = new Map()
): Program => toProgram(spec, drivers, impls)

/** 元编程构造。 */
export const make = <I, O, E extends EffectDecl<any>, Cn extends Connection, Ct extends Control>(
  spec: {
    readonly input: Schema.Schema<I>
    readonly output: Schema.Schema<O>
    readonly effects: ReadonlyArray<E>
    readonly connections: ReadonlyArray<Cn>
    readonly controls: ReadonlyArray<Ct>
  },
  drivers: ReadonlyArray<any>,
  impls: ReadonlyMap<string, ConnectionImpl> = new Map()
): Program => toProgram(spec as AgentSpec<I, O>, drivers, impls)

/** EffectAgent 命名空间（声明）。 */
export const EffectAgent = {
  gen,
  make,
}

/** 便捷：构造一个最小 Control 实例。逻辑由用户提供（d 是具体 driver，方法自选）。 */
export const control = <I = unknown, O = unknown>(
  tag: string,
  logic?: (d: Driver<any, any>, input: I) => Effect.Effect<O, Error>
): Control<I, O> =>
  new (class extends Control<I, O> {
    constructor() { super(tag) }
    run(_i: I, _o: O, _e: ReadonlyArray<EffectDecl<any>>, _cn: ReadonlyArray<Connection>, _ct: ReadonlyArray<Control>, d: Driver) {
      return logic ? logic(d, _i) : Effect.fail(new Error(`Control ${tag} has no logic`))
    }
  })()
