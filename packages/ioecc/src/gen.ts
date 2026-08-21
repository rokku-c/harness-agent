import { Effect, Schema } from "effect"
import { Control } from "./concept.js"
import type { Agent, ConnectionImpl, Driver } from "./concept.js"

/**
 * IOECC —— 声明（五维度）+ 驱动（driver 声明的 control）。
 *
 * 影响声明绑定在 Control 上（`affects`），不绑在 Agent 上。
 * 执行一个 control 后，run 拿到经 affects 声明的 connection（可传给其他 driver/agent）。
 */

/** 五维度描述。 */
export interface AgentSpec<I = unknown, O = unknown, R = never> {
  readonly input: Schema.Schema<I>
  readonly output: Schema.Schema<O>
  readonly connections: ReadonlyArray<string>
  readonly controls: ReadonlyArray<Control<any, any, any>>
}

/** 编译后的可运行程序（含描述，供外部查看/观测）。 */
export interface Program {
  readonly agent: Agent<any, any, any>
  /** 驱动第 index 个 control（执行后 affects 声明的 connection 可访问）。 */
  readonly drive: (index: number, input: unknown) => Effect.Effect<unknown, Error>
  readonly decode: (value: unknown) => Effect.Effect<unknown, Error>
}

/** 驱动一个 control：把 affects 声明的 connection 实现组装后传给 run。 */
const drive = (
  agent: Agent<any, any, any>,
  impls: ReadonlyMap<string, ConnectionImpl>,
  ctrl: Control<any, any, any>,
  input: unknown
): Effect.Effect<unknown, Error> =>
  (ctrl.run(input, agent.output as never, impls) as Effect.Effect<unknown, Error, any>).pipe(
    Effect.mapError((cause) => new Error(`Control ${ctrl._tag} failed: ${String(cause)}`))
  ) as Effect.Effect<unknown, Error, never>

/** 把 AgentSpec 变成可运行程序。 */
const toProgram = (spec: AgentSpec<any, any, any>, drivers: ReadonlyArray<any>, impls: ReadonlyMap<string, ConnectionImpl>): Program => {
  const agent: Agent<any, any, any> = { ...spec, drivers }
  // 声明一致性：每个 control 的 affects 声明的 connection 必须被 agent 声明过。
  const declared = new Set(spec.connections ?? [])
  for (const ctrl of spec.controls ?? []) {
    for (const name of ctrl.affects ?? []) {
      if (!declared.has(name))
        throw new Error(`Control ${ctrl._tag} affects "${name}" but it's not in connections: [${[...declared].join(", ")}]`)
    }
  }
  // 所有 control：agent 自己声明的 + 各 driver 声明的。
  const allControls = [...(spec.controls ?? []), ...drivers.flatMap((d: any) => d.controls ?? [])]
  return {
    agent,
    drive: (index, input) => {
      const ctrl = allControls[index]
      if (!ctrl) return Effect.fail(new Error(`No control at ${index}`))
      return drive(agent, impls, ctrl, input)
    },
    decode: (value) => Schema.decodeUnknown(agent.output)(value),
  }
}

/** 声明：五维度 + drivers + Connection 实现。 */
export const gen = <I, O, R>(
  spec: AgentSpec<I, O, R>,
  drivers: ReadonlyArray<any> = [],
  impls: ReadonlyMap<string, ConnectionImpl> = new Map()
): Program => toProgram(spec, drivers, impls)

/** 元编程构造。 */
export const make = <I, O, R, Cn extends string, Ct extends Control<any, any, any>>(
  spec: {
    readonly input: Schema.Schema<I>
    readonly output: Schema.Schema<O>
    readonly connections: ReadonlyArray<Cn>
    readonly controls: ReadonlyArray<Ct>
  },
  drivers: ReadonlyArray<any> = [],
  impls: ReadonlyMap<string, ConnectionImpl> = new Map()
): Program => toProgram(spec as AgentSpec<I, O, R>, drivers, impls)

/** EffectAgent 命名空间（声明）。 */
export const EffectAgent = {
  gen,
  make,
}

/** 便捷：构造一个最小 Control 实例。 */
export const control = <I = unknown, O = unknown>(
  tag: string,
  affects: ReadonlyArray<string> = [],
  logic?: (input: I, impls: ReadonlyMap<string, ConnectionImpl>) => Effect.Effect<O, Error>
): Control<I, O> =>
  new (class extends Control<I, O> {
    constructor() { super(tag, affects) }
    run(_i: I, _o: O, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error> {
      return logic ? logic(_i, impls) : Effect.fail(new Error(`Control ${tag} has no logic`))
    }
  })()
