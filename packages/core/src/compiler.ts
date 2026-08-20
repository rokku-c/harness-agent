import { Effect, Schema } from "effect"
import { Agent } from "./agent.js"
import type { AgentIR, OutputSpec, ResourceSpec, StageIR } from "./ir.js"
import type { AgentProgram, Binding, Driver, Until } from "./core.js"
import { Context } from "./core.js"
import { AgentError } from "./core.js"
import { runGen, foldAgentOp, type AgentOp, type AgentGen } from "./gen.js"

/**
 * EffectAgent —— agent 编译器。
 *
 * `gen` 产出 IR（描述语言），`compile` 把 IR 编译到现有 AgentBuilder → AgentProgram。
 * 描述与运行分离：IR 纯数据可序列化；compile 时才解析 driver/资源。
 *
 *   const ir = EffectAgent.gen(function*() {
 *     yield* EffectAgent.define("reviewer")
 *     yield* EffectAgent.role("审查项目")
 *     yield* EffectAgent.produces({ kind: "schema", schema: reviewSchema })
 *     yield* EffectAgent.uses({ ref: "project", access: "read" })
 *     yield* EffectAgent.driver("composed", "claude-code")
 *   })
 *
 *   const program = EffectAgent.compile(ir, env)
 *   const result = yield* program.run(input)
 */

/* ── compile 环境：把描述性引用解析成运行时 ── */

/** 编译环境：把 IR 里的 driver/资源/schema 引用解析成运行时。 */
export interface CompileEnv {
  /** 把 DriverRef 解析成真实 Driver。 */
  readonly resolveDriver: (ref: AgentIR["driver"]) => Driver
  /** 把 ResourceSpec 解析成 Binding。 */
  readonly resolveResource?: (ref: ResourceSpec) => Binding
  /** 把 JSON Schema 转回 Effect Schema（compile 时需要真实 schema 校验输出）。 */
  readonly toSchema: (json: NonNullable<Extract<OutputSpec, { kind: "schema" }>["schema"]>) => Schema.Schema<unknown>
}

/** 缺省环境：把 JSON Schema 转回 Effect Schema（尽力而为）。 */
export const defaultToSchema: CompileEnv["toSchema"] = (json): Schema.Schema<unknown> => {
  // 支持最常见的 object 形态；复杂形态退回 Schema.Unknown。
  if (json.type === "object" && json.properties) {
    const entries = Object.entries(json.properties).map(([key, sub]) => {
      const subSchema = defaultToSchema(sub)
      return [key, json.required?.includes(key) ? subSchema : Schema.optional(subSchema)] as const
    })
    return Schema.Struct(Object.fromEntries(entries)) as unknown as Schema.Schema<unknown>
  }
  if (json.type === "array" && json.items) {
    return Schema.Array(defaultToSchema(json.items)) as unknown as Schema.Schema<unknown>
  }
  switch (json.type) {
    case "string": return Schema.String as unknown as Schema.Schema<unknown>
    case "number": return Schema.Number as unknown as Schema.Schema<unknown>
    case "boolean": return Schema.Boolean as unknown as Schema.Schema<unknown>
    default: return Schema.Unknown
  }
}

/* ── OutputSpec → Until ── */

const untilOf = (produces: OutputSpec, env: CompileEnv): Until<unknown> => {
  switch (produces.kind) {
    case "schema": return { _tag: "Schema", schema: env.toSchema(produces.schema) }
    case "stop": return { _tag: "Stop" }
    case "toolCall": return { _tag: "ToolCall", ...(produces.at !== undefined ? { at: produces.at } : {}) }
    case "text": return { _tag: "Text" }
    case "thinking": return { _tag: "Thinking" }
  }
}

/* ── StageIR → Stage ── */

const stageOf = (stage: StageIR): import("./orchestration.js").Stage => ({
  _tag: "Stage",
  marks: stage.marks.map((mark) => ({
    tool: mark.tool,
    ...(mark.gate ? {
      gate: {
        ...(mark.gate.always !== undefined ? { always: mark.gate.always } : {}),
        ...(mark.gate.tools ? { tools: mark.gate.tools } : {}),
      }
    } : {}),
  })),
})

/* ── compile：IR → AgentProgram ── */

export const compile = (
  ir: AgentIR,
  env: CompileEnv
): AgentProgram<unknown, unknown, AgentError, never> => {
  const driver = env.resolveDriver(ir.driver)
  const until = untilOf(ir.produces, env)

  let builder = Agent
    .define<unknown>(ir.id)
    .returns(until)

  for (const resource of ir.uses ?? []) {
    const binding = env.resolveResource?.(resource)
    if (!binding) continue
    builder = resource.access === "write" ? builder.writes(binding) : builder.uses(binding)
  }

  if (ir.stages) builder = builder.stages(stageOf(ir.stages))

  for (const subagent of ir.subagents ?? []) {
    const subUntil = untilOf(subagent.produces, env)
    builder = builder.subagents({
      id: subagent.id,
      until: subUntil,
      access: (subagent.uses ?? []).flatMap((res) => {
        const binding = env.resolveResource?.(res)
        return binding ? [{ binding, write: res.access === "write" }] : []
      }),
      context: (goal: string) => Context.with({ messages: [{ role: "user", content: goal }] }),
    })
  }

  return builder.implementedBy(driver) as AgentProgram<unknown, unknown, AgentError, never>
}

/* ── EffectAgent：gen 入口 + 构造操作 ── */

/** 构造操作集合 —— yield 到 gen 里。 */
export const EffectAgent = {
  /** gen 入口：yield AgentOp，收集成 IR。 */
  gen: <A>(f: () => AgentGen<A>): AgentIR => runGen(f, foldAgentOp)[0],

  define: (id: string): AgentOp => ({ _tag: "Define", id }),
  role: (role: string): AgentOp => ({ _tag: "Role", role }),
  produces: (produces: OutputSpec): AgentOp => ({ _tag: "Produces", produces }),
  uses: (resource: ResourceSpec): AgentOp => ({ _tag: "Uses", resource }),
  stages: (stage: StageIR): AgentOp => ({ _tag: "Stages", stage }),
  subagent: (subagent: AgentIR): AgentOp => ({ _tag: "Subagent", subagent }),
  driver: (kind: AgentIR["driver"]["kind"], name: string): AgentOp => ({ _tag: "Driver", kind, name }),

  /** 编译：IR → AgentProgram。 */
  compile,
}

export { runGen, foldAgentOp }
export type { AgentOp, AgentGen }
