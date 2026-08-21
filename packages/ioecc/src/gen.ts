import { Effect, Schema } from "effect"
import type { Agent, CompileEnv, Connection, Control, Effect as EffectDecl } from "./concept.js"

/**
 * gen 引擎 —— 收集 Agent 描述（effect-ts style）。
 *
 * 与 effect 的 `gen` 不同：yield 的是「描述操作」（agent-construction op），不是要运行的 effect。
 * `EffectAgent.gen(function*() { yield ... })` 收集成纯描述 Agent，compile 才执行。
 *
 * 元编程形态（类型参数声明五维度）：
 *   EffectAgent.make<I, O, E, C, Ctl>({ input, output, effects, connections, controls })
 *   —— 泛型参数声明五维度，compile 时注入 Driver。
 */

/** 一个 gen 的 yield 值：描述操作。adapter 收集，不执行。 */
export type AgentOp =
  | { readonly _tag: "Input"; readonly schema: Schema.Schema<any> }
  | { readonly _tag: "Output"; readonly schema: Schema.Schema<any> }
  | { readonly _tag: "Effect"; readonly effect: EffectDecl<any> }
  | { readonly _tag: "Connection"; readonly connection: Connection }
  | { readonly _tag: "Control"; readonly control: Control }

/** 生成器 DSL：yield AgentOp，返回 A。 */
export type AgentGen<A> = Generator<AgentOp, A, never>

/** 归约：把一个 op 应用进 Agent 描述。 */
export type AgentFold = (agent: Agent<any, any>, op: AgentOp) => Agent<any, any>

/** 默认归约。 */
export const foldAgentOp: AgentFold = (agent, op) => {
  switch (op._tag) {
    case "Input": return { ...agent, input: op.schema }
    case "Output": return { ...agent, output: op.schema }
    case "Effect": return { ...agent, effects: [...agent.effects, op.effect] }
    case "Connection": return { ...agent, connections: [...agent.connections, op.connection] }
    case "Control": return { ...agent, controls: [...agent.controls, op.control] }
  }
}

/** 初始 Agent 描述（缺省字段）。 */
export const emptyAgent = (): Agent<any, any> => ({
  input: Schema.Unknown,
  output: Schema.Unknown,
  effects: [],
  connections: [],
  controls: [],
})

/**
 * 收集器引擎：步进生成器，把 yield 的 AgentOp 折叠进描述，返回 [agent, 返回值]。
 */
export const runGen = <A>(
  f: () => AgentGen<A>,
  fold: AgentFold = foldAgentOp,
  start: Agent<any, any> = emptyAgent()
): [Agent<any, any>, A] => {
  let agent = start
  const gen = f()
  let step = gen.next()
  while (!step.done) {
    agent = fold(agent, step.value)
    step = gen.next()
  }
  return [agent, step.value]
}

/** 编译后的可运行程序。 */
export interface Program {
  readonly drive: (index: number, input: unknown) => Effect.Effect<unknown, Error>
  readonly execute: (effect: EffectDecl<any>) => Effect.Effect<unknown, Error>
  readonly decode: (value: unknown) => Effect.Effect<unknown, Error>
}

/**
 * 元编程形态：类型参数声明五维度。
 *   I   输入 Schema 的类型
 *   O   输出 Schema 的类型
 *   E   effects 的类型联合（影响哪些 Connection）
 *   Cn  connections 的类型（连接哪些世界）
 *   Ct  controls 的类型联合（哪些控制）
 * 值（agent 描述）在 make/compile 时提供，类型参数强制五维度形状。
 */
export interface EffectAgent<I, O, E, Cn, Ct> {
  /** 输入 Schema（I 的运行时形状）。 */
  readonly input: Schema.Schema<I>
  /** 输出 Schema（O 的运行时形状）。 */
  readonly output: Schema.Schema<O>
  /** 影响哪些 Connection（E）。 */
  readonly effects: ReadonlyArray<E>
  /** 连接哪些世界（Cn）。 */
  readonly connections: ReadonlyArray<Cn>
  /** 哪些控制（Ct）。 */
  readonly controls: ReadonlyArray<Ct>
  /** 编译：把描述 + Driver + Connection 实现 → 可运行程序。 */
  readonly compile: (env: CompileEnv) => Program
}

/** 元编程构造：给定五维度值 + 类型参数，产出强类型 Agent。 */
export const make = <I, O, E extends EffectDecl<any>, Cn extends Connection, Ct extends Control>(
  agent: {
    readonly input: Schema.Schema<I>
    readonly output: Schema.Schema<O>
    readonly effects: ReadonlyArray<E>
    readonly connections: ReadonlyArray<Cn>
    readonly controls: ReadonlyArray<Ct>
  },
  compile: (env: CompileEnv) => Program
): EffectAgent<I, O, E, Cn, Ct> => ({ ...agent, compile })

/** gen 入口 + 构造操作（运行时收集形态）。compile 在 compiler.ts 挂载。 */
export const EffectAgent = {
  /** gen 入口：yield 描述操作，收集成纯描述 Agent。 */
  gen: <A>(f: () => AgentGen<A>): Agent<any, any> => runGen(f, foldAgentOp)[0],

  input: (schema: Schema.Schema<any>): AgentOp => ({ _tag: "Input", schema }),
  output: (schema: Schema.Schema<any>): AgentOp => ({ _tag: "Output", schema }),
  effect: (effect: EffectDecl<any>): AgentOp => ({ _tag: "Effect", effect }),
  connection: (connection: Connection): AgentOp => ({ _tag: "Connection", connection }),
  control: (control: Control): AgentOp => ({ _tag: "Control", control }),

  /** 元编程形态：类型参数声明五维度，compile 时注入 Driver。 */
  make,
  /** compile：挂载在 compiler.ts。 */
  compile: () => { throw new Error("EffectAgent.compile not mounted") },
} as {
  gen: <A>(f: () => AgentGen<A>) => Agent<any, any>
  input: (schema: Schema.Schema<any>) => AgentOp
  output: (schema: Schema.Schema<any>) => AgentOp
  effect: (effect: EffectDecl<any>) => AgentOp
  connection: (connection: Connection) => AgentOp
  control: (control: Control) => AgentOp
  make: typeof make
  compile: (agent: Agent<any, any>, env: CompileEnv) => Program
}
