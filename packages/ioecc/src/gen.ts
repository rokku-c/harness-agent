import { Effect, Schema } from "effect"
import { Control } from "./concept.js"
import type { Agent, ConnectionImpl, Driver } from "./concept.js"

/**
 * IOECC —— 声明（connections + controls）+ 驱动（control 的 run）。
 *
 * I/O 和影响声明都在 Control 上；Agent 只是 connections + controls 的组合。
 * 驱动一个 control = 用它的 input Schema 解码输入，跑 run，经 impls 访问影响的世界。
 */

/** Agent 描述。 */
export interface AgentSpec<R = never> {
  readonly connections: ReadonlyArray<string>
  readonly controls: ReadonlyArray<Control<any, any, any>>
}

/** 编译后的可运行程序（含描述，供外部查看/观测）。 */
export interface Program {
  readonly agent: Agent<any>
  /** 驱动第 index 个 control：输入经它的 input Schema 解码，run 经 impls 访问影响的世界。 */
  readonly drive: (index: number, input: unknown) => Effect.Effect<unknown, Error>
  /** 解码第 index 个 control 的输出。 */
  readonly decode: (index: number, value: unknown) => Effect.Effect<unknown, Error>
}

/** 驱动一个 control：解码输入，跑 run。 */
const driveOne = (
  impls: ReadonlyMap<string, ConnectionImpl>,
  ctrl: Control<any, any, any>,
  input: unknown
): Effect.Effect<unknown, Error> =>
  Effect.gen(function* () {
    const decoded = yield* Schema.decodeUnknown(ctrl.input)(input).pipe(
      Effect.mapError((cause) => new Error(`Control ${ctrl._tag} input mismatch: ${cause}`))
    )
    return yield* (ctrl.run(decoded, impls) as Effect.Effect<unknown, Error, any>).pipe(
      Effect.mapError((cause) => new Error(`Control ${ctrl._tag} failed: ${String(cause)}`))
    )
  }) as Effect.Effect<unknown, Error, never>

/** 把 AgentSpec 变成可运行程序。 */
const toProgram = (spec: AgentSpec<any>, drivers: ReadonlyArray<any>, impls: ReadonlyMap<string, ConnectionImpl>): Program => {
  const agent: Agent<any> = { ...spec, drivers }
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
      return driveOne(impls, ctrl, input)
    },
    decode: (index, value) => {
      const ctrl = allControls[index]
      if (!ctrl) return Effect.fail(new Error(`No control at ${index}`))
      return Schema.decodeUnknown(ctrl.output)(value).pipe(
        Effect.mapError((cause) => new Error(`Control ${ctrl._tag} output mismatch: ${String(cause)}`))
      ) as Effect.Effect<unknown, Error, never>
    },
  }
}

/** 声明：connections + controls + drivers + Connection 实现。 */
export const gen = <R>(
  spec: AgentSpec<R>,
  drivers: ReadonlyArray<any> = [],
  impls: ReadonlyMap<string, ConnectionImpl> = new Map()
): Program => toProgram(spec, drivers, impls)

/** 元编程构造。 */
export const make = <R, Cn extends string, Ct extends Control<any, any, any>>(
  spec: {
    readonly connections: ReadonlyArray<Cn>
    readonly controls: ReadonlyArray<Ct>
  },
  drivers: ReadonlyArray<any> = [],
  impls: ReadonlyMap<string, ConnectionImpl> = new Map()
): Program => toProgram(spec as AgentSpec<R>, drivers, impls)

/** EffectAgent 命名空间（声明）。 */
export const EffectAgent = {
  gen,
  make,
}

/** 便捷：构造一个最小 Control 实例（自带 I/O）。 */
export const control = <I = unknown, O = unknown>(
  tag: string,
  affects: ReadonlyArray<string> = [],
  run: (input: I, impls: ReadonlyMap<string, ConnectionImpl>) => Effect.Effect<O, Error>,
  io?: { input?: Schema.Schema<I>; output?: Schema.Schema<O> }
): Control<I, O> =>
  new (class extends Control<I, O> {
    readonly input: Schema.Schema<I> = (io?.input ?? Schema.Unknown) as Schema.Schema<I>
    readonly output: Schema.Schema<O> = (io?.output ?? Schema.Unknown) as Schema.Schema<O>
    constructor() { super(tag, affects) }
    run(_i: I, _impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error> {
      return run(_i, _impls)
    }
  })()
