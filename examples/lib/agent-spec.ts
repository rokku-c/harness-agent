/**
 * examples/lib/agent-spec.ts — 宿主侧工具库：AgentSpec 的 Schema 契约、宿主编译、driver 路由。
 *
 * 这是「meta-agent → 生成 Agent」两条路径共享的宿主层（examples/11 与 examples/12 都用它）：
 *
 *   - `AgentSpec` 是 meta-agent 的结构化输出契约（Effect Schema 强制），字段类型是一个受控 DSL，
 *     保证宿主一定能把 spec 编译成真实 Agent。
 *   - `compileSpec` / `renderSpec` 把 spec 编译成可运行的 AgentProgram，或渲染成可 review 的源码文件。
 *   - `makeBuilder` / `resolveOps` 把 spec 里的工具选择映射到宿主工具注册表（TOOLS），execute 全部由
 *     宿主实现——meta-agent 永远只「选工具 + 配参数」，不能定义副作用。
 *   - 本文件不发起任何外部 SDK 调用（避免示例 import 时触发 API 费用），只做纯编译 / 渲染 / 路由。
 */
import { Effect, Schema } from "effect"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import {
  Agent,
  AgentBuilder,
  AgentContext,
  ClaudeCode,
  CodexAgent,
  ConsoleHook,
  Op,
  PiAgent,
  Until,
  Uri,
  type AgentError,
  type AgentProgram,
  type Binding,
  type Driver,
  type ProviderCatalog,
  type SubagentProgram
} from "effect-agent"

/* ────────────────────────── 受控 DSL（Schema 强制） ────────────────────────── */

/** 字段 DSL 的类型。Element / properties 递归引用自己，形成可嵌套的字段描述。 */
export type Field =
  | { readonly kind: "string" }
  | { readonly kind: "number" }
  | { readonly kind: "boolean" }
  | { readonly kind: "enum"; readonly values: ReadonlyArray<string> }
  | { readonly kind: "array"; readonly element: Field }
  | { readonly kind: "object"; readonly properties: ReadonlyArray<{ readonly name: string; readonly field: Field }> }

const fieldSchema: Schema.Schema<Field> = Schema.suspend((): Schema.Schema<Field> =>
  Schema.Union(
    Schema.Struct({ kind: Schema.Literal("string") }),
    Schema.Struct({ kind: Schema.Literal("number") }),
    Schema.Struct({ kind: Schema.Literal("boolean") }),
    Schema.Struct({ kind: Schema.Literal("enum"), values: Schema.Array(Schema.String) }),
    Schema.Struct({ kind: Schema.Literal("array"), element: fieldSchema }),
    Schema.Struct({
      kind: Schema.Literal("object"),
      properties: Schema.Array(Schema.Struct({ name: Schema.String, field: fieldSchema }))
    })
  ).annotations({ identifier: "AgentSpecField" }))

const OpsSpec = Schema.Struct({
  tool: Schema.String,
  access: Schema.Literal("read", "write"),
  args: Schema.Array(Schema.Struct({ name: Schema.String, value: Schema.String }))
})

const SubagentSpec = Schema.Struct({
  id: Schema.String,
  ops: Schema.Array(OpsSpec)
})

/** meta-agent 的输出契约：一份 Agent 的可执行规格。 */
const AgentSpec = Schema.Struct({
  id: Schema.String,
  driver: Schema.String,
  output: Schema.Array(Schema.Struct({ name: Schema.String, field: fieldSchema })),
  ops: Schema.Array(OpsSpec),
  subagents: Schema.Array(SubagentSpec)
})
export type AgentSpec = Schema.Schema.Type<typeof AgentSpec>

/** 供宿主把 meta-agent 输出（unknown）解码成 AgentSpec，schema 不符时返回显式错误。 */
export const decodeAgentSpec = (value: unknown): Effect.Effect<AgentSpec, Error, never> =>
  Schema.decodeUnknown(AgentSpec)(value).pipe(Effect.mapError((cause) => new Error(`AgentSpec 无效: ${cause}`)))

/* ────────────────────────── 宿主工具注册表 ────────────────────────── */

/** 宿主侧 execute 实现：输入是 string（args 里的具体值），输出是 string（给模型的原始文本）。 */
type ToolFactory = (args: Record<string, string>) => Binding

const escPath = (value: string): string => value.replace(/\\/g, "/").trim()

/** 项目根（本仓库），所有宿主工具都锁在该目录内，不允许路径逃逸。去掉尾部斜杠，保证 inRoot 前缀比较正确。 */
const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/+$/, "")

const resolveRoot = (args: Record<string, string>): string => (args["root"] ? join(ROOT, escPath(args["root"])) : ROOT)

const inRoot = (root: string, path: string): string => {
  const target = join(root, path)
  if (target !== root && !target.startsWith(root + "/")) throw new Error(`路径逃逸项目目录: ${path}`)
  return target
}

/** 宿主工具注册表。execute 全部由宿主实现且安全可控；meta-agent 只能按名引用。 */
export const TOOLS: Record<string, ToolFactory> = {
  projectListFiles: (args) => {
    const root = resolveRoot(args)
    return {
      uri: Uri.make("local", "filesystem", args["label"] ?? "project"),
      ops: [Op.read({
        name: "meta.listFiles",
        description: "列出项目根下的源代码和配置文件（排除 node_modules / .git / dist）。",
        input: Schema.Struct({ pattern: Schema.optionalWith(Schema.String, { default: () => "**/*" }) }),
        output: Schema.Array(Schema.String),
        execute: ({ pattern }) => Effect.tryPromise({
          try: async () => {
            const { glob, stat } = await import("node:fs/promises")
            const { relative } = await import("node:path")
            const files: string[] = []
            for await (const path of glob(pattern ?? "**/*", {
              cwd: root,
              exclude: ["node_modules/**", ".git/**", "dist/**", "examples/generated/**"]
            })) {
              const target = inRoot(root, path)
              if ((await stat(target)).isFile()) files.push(relative(root, target))
              if (files.length >= 250) break
            }
            return files.sort()
          },
          catch: (cause) => new Error(`无法列出项目文件: ${String(cause)}`)
        })
      })]
    }
  },
  projectReadFile: (args) => {
    const root = resolveRoot(args)
    return {
      uri: Uri.make("local", "filesystem", args["label"] ?? "project"),
      ops: [Op.read({
        name: "meta.readFile",
        description: "读取项目根下一个 UTF-8 文本文件（≤ 256 KiB）。",
        input: Schema.Struct({ path: Schema.String }),
        output: Schema.String,
        execute: ({ path }) => Effect.tryPromise({
          try: async () => {
            const { stat, readFile } = await import("node:fs/promises")
            const target = inRoot(root, path)
            const info = await stat(target)
            if (!info.isFile()) throw new Error(`不是文件: ${path}`)
            if (info.size > 256 * 1024) throw new Error(`文件过大: ${path}`)
            return readFile(target, "utf8")
          },
          catch: (cause) => new Error(`无法读取 ${path}: ${String(cause)}`)
        })
      })]
    }
  },
  projectWriteFile: (args) => {
    const root = resolveRoot(args)
    return {
      uri: Uri.make("local", "filesystem", args["label"] ?? "project"),
      ops: [Op.write({
        name: "meta.writeFile",
        description: "在项目根下写一个 UTF-8 文本文件（新建或覆盖）。",
        input: Schema.Struct({ path: Schema.String, content: Schema.String }),
        output: Schema.String,
        execute: ({ path, content }) => Effect.tryPromise({
          try: async () => {
            const { mkdir, writeFile } = await import("node:fs/promises")
            const target = inRoot(root, path)
            await mkdir(dirname(target), { recursive: true })
            await writeFile(target, content, "utf8")
            return path
          },
          catch: (cause) => new Error(`无法写入 ${path}: ${String(cause)}`)
        })
      })]
    }
  },
  readDocs: (args) => ({
    uri: Uri.make("local", "docs", args["label"] ?? "docs"),
    ops: [Op.read({
      name: "meta.readDocs",
      description: "读取框架文档或示例（DESIGN.md / DRAFT.md / examples/README.md 等），供设计 Agent 时参考惯例。",
      input: Schema.Struct({ path: Schema.String }),
      output: Schema.String,
      execute: ({ path }) => Effect.tryPromise({
        try: async () => {
          const { readFile } = await import("node:fs/promises")
          return readFile(inRoot(resolveRoot(args), path), "utf8")
        },
        catch: (cause) => new Error(`无法读取文档 ${path}: ${String(cause)}`)
      })
    })]
  })
}

export const toolNames = (): string => Object.keys(TOOLS).join("、")

/** 只读框架文档的绑定，供 meta-agent 与 swarm 角色共用（execute 全部宿主实现）。 */
export const readDocsBinding: Binding = TOOLS["readDocs"]({ label: "framework-docs", root: "" })

/** 把 spec 里的 Op 选择解析成宿主 Binding 列表；不认识的名字直接报错，不让模型静默通过。 */
export const resolveOps = (ops: ReadonlyArray<{ tool: string; access: string; args: ReadonlyArray<{ name: string; value: string }> }>): Binding[] =>
  ops.map((op) => {
    const factory = TOOLS[op.tool]
    if (!factory) throw new Error(`未知工具: ${op.tool}（注册表: ${toolNames()}）`)
    return factory(Object.fromEntries(op.args.map(({ name, value }) => [name, value])))
  })

/* ────────────────────────── 宿主把 spec 绑定到 Agent builder ────────────────────────── */

/**
 * 从 spec 的 system + ops 构造一个已应用工具绑定的 AgentBuilder。
 * 这是 A/B 两条路线共用的宿主装配核心：meta-agent 只提供字段，宿主负责实例化。
 */
export function makeBuilder(
  until: Until<any>,
  ops: ReadonlyArray<{ tool: string; access: string; args: ReadonlyArray<{ name: string; value: string }> }>
): AgentBuilder<string, any, any>
/** @deprecated compatibility form; generated agents use the capability-only form above. */
export function makeBuilder(
  _id: string,
  _always: string,
  until: Until<any>,
  ops: ReadonlyArray<{ tool: string; access: string; args: ReadonlyArray<{ name: string; value: string }> }>
): AgentBuilder<string, any, any>
export function makeBuilder(
  first: string | Until<any>,
  second: string | ReadonlyArray<{ tool: string; access: string; args: ReadonlyArray<{ name: string; value: string }> }>,
  third?: Until<any>,
  fourth?: ReadonlyArray<{ tool: string; access: string; args: ReadonlyArray<{ name: string; value: string }> }>
): AgentBuilder<string, any, any> {
  const until = typeof first === "string" ? third! : first
  const ops = (typeof first === "string" ? fourth : second) as ReadonlyArray<{ tool: string; access: string; args: ReadonlyArray<{ name: string; value: string }> }>
  let builder = Agent
    .define<string>((input) => AgentContext.input(input))
    .returns(until)
  for (const op of ops) {
    const binding = TOOLS[op.tool]?.(Object.fromEntries(op.args.map(({ name, value }) => [name, value])))
    if (!binding) throw new Error(`未知工具: ${op.tool}（注册表: ${toolNames()}）`)
    builder = op.access === "write" ? builder.writes(binding) : builder.uses(binding)
  }
  return builder
}

/* ────────────────────────── driver 路由 ────────────────────────── */

/**
 * 把 spec.driver 字符串路由到真实 Driver。
 *  - "claude-code" / "codex" / "pi" → 对应 ComposedAgent；
 *  - 其他 → 视为 config.toml 中的 provider 名，交给 ProviderCatalog。
 * 原生 provider 驱动由 11 / 12 各自单独构造（不同认证方式），不在这里统一。
 */
export const selectDriver = (name: string, providers: ProviderCatalog): Driver => {
  switch (name) {
    case "claude-code": return ClaudeCode.make()
    case "codex": return CodexAgent.make()
    case "pi": return PiAgent.make()
    default: return providers.agent(name)
  }
}

/* ────────────────────────── Field → Schema 编译器 ────────────────────────── */

/** 把 spec 里的 Field DSL 编译成 Effect Schema（宿主的强类型化手段）。 */
export const fieldToSchema = (field: Field): Schema.Schema<any, any, never> => {
  switch (field.kind) {
    case "string": return Schema.String
    case "number": return Schema.Number
    case "boolean": return Schema.Boolean
    case "enum": return Schema.Union(...field.values.map((value) => Schema.Literal(value)))
    case "array": return Schema.Array(fieldToSchema(field.element))
    case "object": return Schema.Struct(Object.fromEntries(
      field.properties.map(({ name, field: sub }) => [name, fieldToSchema(sub)])))
    default: throw new Error(`未知字段类型: ${(field as { kind: string }).kind}`)
  }
}

export const outputSchemaOf = (output: AgentSpec["output"]): Schema.Schema<any, any, never> =>
  Schema.Struct(Object.fromEntries(output.map(({ name, field }) => [name, fieldToSchema(field)])))

/* ────────────────────────── Route A：compileSpec（运行时动态组装） ────────────────────────── */

/**
 * 把 AgentSpec 编译成可运行的 AgentProgram（Route A，examples/11 使用）。
 * 动态组装的产物 I/O 是 any——这是「运行时生成」的固有代价；想要强类型产物走 Route B（渲染源码）。
 */
export const compileSpec = (
  spec: AgentSpec,
  env: { selectDriver: (name: string) => Driver }
): AgentProgram<string, any, AgentError, any> => {
  const output = outputSchemaOf(spec.output)
  let builder = makeBuilder(Until.schema(output), spec.ops)
  for (const sub of spec.subagents) {
    const subBuilder = makeBuilder(Until.stop, sub.ops)
    const subagent: SubagentProgram = {
      id: sub.id,
      until: Until.stop,
      access: subBuilder.definition.access as ReadonlyArray<{ binding: Binding; write: boolean }>,
      context: (goal) => AgentContext.input({ operation: "delegate", goal })
    }
    builder = builder.subagents(subagent)
  }
  return builder.implementedBy(env.selectDriver(spec.driver)) as AgentProgram<string, any, AgentError, any>
}

/* ────────────────────────── Route B：renderSpec（渲染成可 review 源码） ────────────────────────── */

const renderField = (field: Field, indent: string): string => {
  switch (field.kind) {
    case "string": return "Schema.String"
    case "number": return "Schema.Number"
    case "boolean": return "Schema.Boolean"
    case "enum": return `Schema.Union(...${JSON.stringify(field.values)}.map((v) => Schema.Literal(v)))`
    case "array": return `Schema.Array(${renderField(field.element, indent)})`
    case "object": {
      const lines = field.properties.map(({ name, field: sub }) =>
        `${indent}  ${JSON.stringify(name)}: ${renderField(sub, indent + "    ")}`)
      return `Schema.Struct({\n${lines.join(",\n")}\n${indent}  })`
    }
  }
}

const argsOf = (op: { args: ReadonlyArray<{ name: string; value: string }> }, indent: string): string => {
  if (op.args.length === 0) return "{}"
  const lines = op.args.map(({ name, value }) => `${indent}  ${JSON.stringify(name)}: ${JSON.stringify(value)}`)
  return `{\n${lines.join(",\n")}\n${indent}}`
}

/** 渲染 `builder = builder.uses(TOOLS["..."]({...}))` 形式的行。 */
const renderOpAssignment = (
  op: { tool: string; access: string; args: ReadonlyArray<{ name: string; value: string }> },
  indent: string
): string =>
  `${indent}builder = builder.${op.access === "write" ? "writes" : "uses"}(TOOLS[${JSON.stringify(op.tool)}](${argsOf(op, indent + "  ")}))`

/** 渲染一个 SubagentProgram 字面量（access 直接由宿主 TOOLS 构造）。 */
const renderSubagentLiteral = (
  sub: { id: string; ops: ReadonlyArray<{ tool: string; access: string; args: ReadonlyArray<{ name: string; value: string }> }> },
  name: string,
  indent: string
): string => {
  const accessLines = sub.ops.map((op) =>
    `${indent}    { binding: TOOLS[${JSON.stringify(op.tool)}](${argsOf(op, indent + "      ")}), write: ${op.access === "write"} },`)
  const accessBlock = accessLines.length > 0 ? `\n${accessLines.join("\n")}` : "[]"
  return `${indent}const ${name} = {
${indent}  id: ${JSON.stringify(sub.id)},
${indent}  until: Until.stop,
${indent}  access: [${accessBlock}${accessLines.length > 0 ? "\n" + indent + "  " : ""}],
${indent}  context: (goal: string) => AgentContext.input({ operation: "delegate", goal })
${indent}}`
}

/**
 * 把 AgentSpec 渲染成一份独立的、可 review / 可运行的 TypeScript 源文件（Route B，examples/12 使用）。
 * 渲染产物用宿主注册表 TOOLS + Schema 表达式，因此是类型安全的（不再是 any）。
 * 返回生成文件的绝对路径；写入前自动创建目录。
 */
export const renderSpec = (spec: AgentSpec, outPath: string): Effect.Effect<string, Error, never> =>
  Effect.tryPromise({
    try: async () => {
      const indent = "  "
      const outputBlock = spec.output
        .map(({ name, field }) => `${indent}  ${JSON.stringify(name)}: ${renderField(field, indent + "    ")}`)
        .join(",\n")
      const opBlock = spec.ops.map((op) => renderOpAssignment(op, indent)).join("\n")
      const subBlock = spec.subagents
        .map((sub, index) => {
          const name = index === 0 ? "subagent" : `subagent_${index}`
          const decl = renderSubagentLiteral(sub, name, indent)
          return `${decl}\n${indent}builder = builder.subagents(${name})`
        })
        .join("\n\n")

      const source = `/**
 * 由 meta-agent 生成的 Agent（examples/12-meta-agent-render.ts 产出）。
 * spec: ${spec.id} / driver: ${spec.driver}
 * 结构由宿主 renderSpec 渲染，可 review 后自行修改。
 *
 * 直跑：bun run examples/generated/${spec.id}.ts -- "<task>"
 */
import { Effect, Schema } from "effect"
import { Agent, AgentContext, ClaudeCode, ConsoleHook, Harness, Until, type Driver } from "effect-agent"
import { TOOLS } from "../lib/agent-spec.js"

// 生成的输出 Schema（宿主从 spec.output 编译）。
export const GeneratedOutput = Schema.Struct({
${outputBlock}
})

export const makeGeneratedAgent = (driver: Driver) => {
  let builder = Agent
    .define<string>((input) => AgentContext.input(input))
    .returns(Until.schema(GeneratedOutput))

  // 宿主工具注册表：execute 全部由宿主实现。
${opBlock}

  // 运行时派生的子代理（仅在 driver 支持时可用，如 claude-code）。
${subBlock}

  return builder
}

// 直跑模式：bun run examples/generated/${spec.id}.ts -- "<task>"
if (process.argv[1] && import.meta.path === process.argv[1]) {
  const driver = Harness.withHooks(ClaudeCode.make(), ConsoleHook)
  const task = process.argv[2] ?? "运行生成的任务"
  Effect.runPromise(makeGeneratedAgent(driver).implementedBy(driver).run(task))
    .then((result) => { console.log(JSON.stringify(result.output, null, 2)); process.exit(0) })
    .catch((cause) => { console.error(cause); process.exit(1) })
}
`
      await mkdir(dirname(outPath), { recursive: true })
      await writeFile(outPath, source, "utf8")
      return outPath
    },
    catch: (cause) => new Error(`渲染生成文件失败: ${String(cause)}`)
  })

/* ────────────────────────── 共享的 meta-agent 构造 ────────────────────────── */

export const META_CONSTRAINTS = {
  drivers: ["claude-code", "codex", "pi", "configured-provider"],
  tools: toolNames(),
  fieldKinds: ["string", "number", "boolean", "enum", "array", "object"],
  hostOwnsExecution: true,
  schemaRequired: true
} as const

/** meta-agent 本身就是一个普通 Agent：输出 Schema 强制，可 review / 可校验 / 可版本化。 */
export const makeMetaAgent = (driver: Driver) =>
  Agent
    .define<string>((requirement) => AgentContext.input({
      operation: "define-agent-spec",
      requirement,
      constraints: META_CONSTRAINTS
    }))
    .returns(Until.schema(AgentSpec))
    .uses(TOOLS["readDocs"]({ label: "framework-docs", root: "" }))
    .implementedBy(driver)

/** 供宿主在生成 Agent 时输出一条可读审计信息（受 META_AGENT_VERBOSE=1 控制）。 */
export const emitSpecEvent = (message: string): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    if (Bun.env.META_AGENT_VERBOSE === "1") console.error(`[spec] ${message}`)
  })
