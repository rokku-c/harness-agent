import { Schema } from "effect"

/**
 * AgentIR —— agent 的编译中间表示（描述语言）。
 *
 * 纯数据、Schema-backed、可序列化 —— 不依赖任何 runtime（driver/schema 对象）。
 * 这就是「专门的描述语言」：可被 meta-agent 生成、序列化/反序列化、跨基座解释。
 *
 *   const ir: AgentIR = {
 *     id: "reviewer",
 *     produces: { kind: "schema", schema: { type: "object", properties: {...} } },
 *     uses: [{ ref: "project", access: "read" }],
 *     driver: { kind: "composed", name: "claude-code" }
 *   }
 *
 * 编译（EffectAgent.compile，compiler.ts）时把 DriverRef/ResourceSpec 解析成运行时。
 */

/* ── 产出契约：纯数据版 Until ── */

/** 产出契约（序列化的 Until）。schema 用 JSON Schema（可序列化）。 */
export type OutputSpec =
  | { readonly kind: "schema"; readonly schema: JsonSchema }
  | { readonly kind: "stop" }
  | { readonly kind: "toolCall"; readonly at?: number }
  | { readonly kind: "text" }
  | { readonly kind: "thinking" }

/** JSON Schema 的足够子集（描述结构化输出）。 */
export interface JsonSchema {
  readonly type: "object" | "string" | "number" | "boolean" | "array"
  readonly properties?: Readonly<Record<string, JsonSchema>>
  readonly required?: ReadonlyArray<string>
  readonly items?: JsonSchema
}

/* ── 资源契约：描述性引用 ── */

/** 注入形式（与 ResourceInjection 同义，纯数据）。 */
export type ResourceAccess = "read" | "write"

/** 资源引用 —— compile 时解析成 Binding。 */
export interface ResourceSpec {
  /** 资源标识（uri 或名字），resolveResource 解析。 */
  readonly ref: string
  readonly access: ResourceAccess
}

/* ── 编排：纯数据版 Stage ── */

/** 阶段 gate（解锁配置）—— 纯数据。 */
export interface GateIR {
  readonly always?: string
  readonly tools?: Readonly<Record<string, "show" | "hide" | "allow" | "deny">>
}

/** 推进路径 —— 一串阶段，每节点带可选 gate。 */
export interface StageIR {
  readonly marks: ReadonlyArray<{ readonly tool: string; readonly gate?: GateIR }>
}

/* ── 子代理 ── */

export interface SubagentIR {
  readonly id: string
  readonly produces: OutputSpec
  readonly uses?: ReadonlyArray<ResourceSpec>
}

/* ── 靠谁执行 ── */

/** 描述性 driver 引用 —— compile 时解析成真实 Driver。 */
export interface DriverRef {
  readonly kind: "provider" | "composed" | "native" | "custom"
  readonly name: string
}

/* ── Schema（序列化契约） ── */

const JsonSchemaSchema: Schema.Schema<JsonSchema> = Schema.suspend((): Schema.Schema<JsonSchema> =>
  Schema.Struct({
    type: Schema.Literal("object", "string", "number", "boolean", "array"),
    properties: Schema.optional(Schema.Record({ key: Schema.String, value: JsonSchemaSchema })),
    required: Schema.optional(Schema.Array(Schema.String)),
    items: Schema.optional(JsonSchemaSchema),
  }).annotations({ identifier: "AgentIRJsonSchema" }) as unknown as Schema.Schema<JsonSchema>)

export const OutputSpecSchema: Schema.Schema<OutputSpec> = Schema.Union(
  Schema.Struct({ kind: Schema.Literal("schema"), schema: JsonSchemaSchema }),
  Schema.Struct({ kind: Schema.Literal("stop") }),
  Schema.Struct({ kind: Schema.Literal("toolCall"), at: Schema.optional(Schema.Number) }),
  Schema.Struct({ kind: Schema.Literal("text") }),
  Schema.Struct({ kind: Schema.Literal("thinking") }),
)

export const ResourceSpecSchema = Schema.Struct({
  ref: Schema.String,
  access: Schema.Literal("read", "write"),
})

export const GateIRSchema = Schema.Struct({
  always: Schema.optional(Schema.String),
  tools: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Literal("show", "hide", "allow", "deny"),
  })),
})

export const StageIRSchema = Schema.Struct({
  marks: Schema.Array(Schema.Struct({
    tool: Schema.String,
    gate: Schema.optional(GateIRSchema),
  })),
})

export const SubagentIRSchema = Schema.Struct({
  id: Schema.String,
  produces: OutputSpecSchema,
  uses: Schema.optionalWith(Schema.Array(ResourceSpecSchema), { default: () => [] }),
})

export const DriverRefSchema = Schema.Struct({
  kind: Schema.Literal("provider", "composed", "native", "custom"),
  name: Schema.String,
})

/** 从 Effect Schema 提取 JSON Schema（供 OutputSpec.kind === "schema" 用）。 */
export const toJsonSchema = <A>(schema: Schema.Schema<A, any, never>): JsonSchema => {
  const json = JSON.parse(JSON.stringify(schema)) as { type?: string; properties?: unknown; items?: unknown }
  // JSON Schema.make(schema) 更可靠，但这里保持纯数据手写子集。
  return {
    type: (json.type === "object" ? "object" : json.type === "array" ? "array" : "string") as JsonSchema["type"],
    ...(json.properties && typeof json.properties === "object" ? { properties: json.properties as Readonly<Record<string, JsonSchema>> } : {}),
  }
}

/* ── AgentIR（依赖上述所有 Schema） ── */

export const AgentIRSchema = Schema.Struct({
  id: Schema.String,
  role: Schema.optional(Schema.String),
  produces: OutputSpecSchema,
  uses: Schema.optionalWith(Schema.Array(ResourceSpecSchema), { default: () => [] }),
  stages: Schema.optional(StageIRSchema),
  subagents: Schema.optionalWith(Schema.Array(SubagentIRSchema), { default: () => [] }),
  driver: DriverRefSchema,
})

/** AgentIR = Schema 的 Type（单一事实源）。 */
export type AgentIR = Schema.Schema.Type<typeof AgentIRSchema>
