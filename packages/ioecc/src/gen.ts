import { Schema } from "effect"
import type { Agent, Connection, Control, Effect as EffectDecl } from "./concept.js"

/**
 * gen 引擎 —— 收集 Agent 描述（effect-ts style）。
 *
 * 与 effect 的 `gen` 不同：yield 的是「描述操作」（agent-construction op），不是要运行的 effect。
 * `EffectAgent.gen(function*() { yield ... })` 收集成纯描述 Agent，compile 才执行。
 *
 *   const agent = EffectAgent.gen(function*() {
 *     yield EffectAgent.input(Schema.Struct({ city: Schema.String }))
 *     yield EffectAgent.output(Schema.Void)
 *     yield EffectAgent.effect(fetchWeather)
 *     yield EffectAgent.connection({ name: "WeatherApp" })
 *     yield EffectAgent.control({ _tag: "OnInput" })
 *   })
 *   // agent: 纯描述，compile(agent, env) 才可执行
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

/** gen 入口 + 构造操作。 */
export const EffectAgent = {
  /** gen 入口：yield 描述操作，收集成纯描述 Agent。 */
  gen: <A>(f: () => AgentGen<A>): Agent<any, any> => runGen(f, foldAgentOp)[0],

  input: (schema: Schema.Schema<any>): AgentOp => ({ _tag: "Input", schema }),
  output: (schema: Schema.Schema<any>): AgentOp => ({ _tag: "Output", schema }),
  effect: (effect: EffectDecl<any>): AgentOp => ({ _tag: "Effect", effect }),
  connection: (connection: Connection): AgentOp => ({ _tag: "Connection", connection }),
  control: (control: Control): AgentOp => ({ _tag: "Control", control }),
}
