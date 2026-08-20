import type { AgentIR, OutputSpec, ResourceSpec, StageIR } from "./ir.js"

/**
 * gen 引擎 —— 通用收集器，任意 `xxx.gen` 复用。
 *
 * effect 的 `gen` 是一个 coroutine adapter：`yield*` 解包一个值，adapter 驱动 generator。
 * 对 agent 编译器，`yield*` 解包的是**描述操作**（agent-construction op），不是要运行的 effect。
 *
 * 核心：`runGen` 步进 generator，把每个 yield 的 op 折叠进 IR，返回 [IR, 返回值]。
 * 纯收集器，不执行任何副作用 —— 这才是「编译器」：描述与运行分离。
 *
 *   const [ir, extra] = runGen(f, fold)
 *
 * `AgentOp` 是「agent 描述操作」的联合；`fold` 是「把 op 应用进 IR」的归约。
 * 未来要造其它 `xxx.gen`（如 group.gen），只需换 `AgentOp` 联合和 `fold`。
 */

/** 一个 gen 的 yield 值：描述操作。adapter 收集，不执行。 */
export type AgentOp =
  | { readonly _tag: "Define"; readonly id: string }
  | { readonly _tag: "Role"; readonly role: string }
  | { readonly _tag: "Produces"; readonly produces: OutputSpec }
  | { readonly _tag: "Uses"; readonly resource: ResourceSpec }
  | { readonly _tag: "Stages"; readonly stage: StageIR }
  | { readonly _tag: "Subagent"; readonly subagent: AgentIR }
  | { readonly _tag: "Driver"; readonly kind: "provider" | "composed" | "native" | "custom"; readonly name: string }

/** 生成器 DSL：yield AgentOp，返回 A。 */
export type AgentGen<A> = Generator<AgentOp, A, never>

/** 归约：把一个 op 应用进 IR。 */
export type AgentFold = (ir: AgentIR, op: AgentOp) => AgentIR

/** 默认归约：把 op 折叠进 AgentIR。 */
export const foldAgentOp: AgentFold = (ir, op) => {
  switch (op._tag) {
    case "Define": return { ...ir, id: op.id }
    case "Role": return { ...ir, role: op.role }
    case "Produces": return { ...ir, produces: op.produces }
    case "Uses": return { ...ir, uses: [...(ir.uses ?? []), op.resource] }
    case "Stages": return { ...ir, stages: op.stage }
    case "Subagent": return { ...ir, subagents: [...(ir.subagents ?? []), op.subagent] }
    case "Driver": return { ...ir, driver: { kind: op.kind, name: op.name } }
  }
}

/** 初始 IR（缺省字段）。 */
export const emptyIR = (): AgentIR => ({
  id: "agent",
  produces: { kind: "stop" },
  uses: [],
  subagents: [],
  driver: { kind: "composed", name: "claude-code" },
})

/**
 * 收集器引擎：步进生成器，把 yield 的 AgentOp 折叠进 IR，返回 [IR, 返回值]。
 *
 *   const [ir, extra] = runGen(() => { yield* ...; return extra }, fold)
 */
export const runGen = <A>(
  f: () => AgentGen<A>,
  fold: AgentFold = foldAgentOp,
  start: AgentIR = emptyIR()
): [AgentIR, A] => {
  let ir = start
  const gen = f()
  let step = gen.next()
  while (!step.done) {
    ir = fold(ir, step.value)
    step = gen.next()
  }
  return [ir, step.value]
}
