import { Effect, Schema } from "effect"
import { glob } from "node:fs/promises"
import { readFile, stat } from "node:fs/promises"
import { relative, resolve, sep } from "node:path"
import {
  Agent,
  AgentContext,
  ClaudeCode,
  Harness,
  Op,
  Until,
  Uri,
  type Binding,
  type SubagentProgram
} from "effect-agent"
import { DetailHook } from "./hooks/detailed-review.js"

const Review = Schema.Struct({
  verdict: Schema.String,
  issues: Schema.Array(Schema.String),
  summary: Schema.String
})

const root = process.cwd()
const insideRoot = (path: string) => {
  const target = resolve(root, path)
  if (target !== root && !target.startsWith(root + sep)) throw new Error(`Path escapes project: ${path}`)
  return target
}

const ListFiles = Op.read({
  name: "project.listFiles",
  description: "列出当前项目中的源代码和配置文件。",
  input: Schema.Struct({ pattern: Schema.optionalWith(Schema.String, { default: () => "**/*" }) }),
  output: Schema.Array(Schema.String),
  execute: ({ pattern }) => Effect.tryPromise({
    try: async () => {
      const files: string[] = []
      for await (const path of glob(pattern, { cwd: root, exclude: ["node_modules/**", ".git/**", "dist/**"] })) {
        const target = insideRoot(path)
        if ((await stat(target)).isFile()) files.push(relative(root, target))
      }
      return files.sort()
    },
    catch: (cause) => new Error(`Unable to list project files: ${String(cause)}`)
  })
})

const ReadFile = Op.read({
  name: "project.readFile",
  description: "读取当前项目中的一个 UTF-8 文本文件（≤ 256 KiB）。",
  input: Schema.Struct({ path: Schema.String }),
  output: Schema.String,
  execute: ({ path }) => Effect.tryPromise({
    try: async () => {
      const target = insideRoot(path)
      const info = await stat(target)
      if (!info.isFile()) throw new Error(`Not a file: ${path}`)
      if (info.size > 256 * 1024) throw new Error(`File is too large: ${path}`)
      return readFile(target, "utf8")
    },
    catch: (cause) => new Error(`Unable to read ${path}: ${String(cause)}`)
  })
})

const Project: Binding = {
  uri: Uri.make("local", "filesystem", "current-project"),
  ops: [ListFiles, ReadFile]
}

// 声明一个运行时派生的子代理：主模型在运行中可通过 delegate 工具
// 调用它（用 goal 输入任务），子代理作为一个独立进程运行并返回结果。
const reviewer: SubagentProgram = {
  id: "reviewer",
  until: Until.stop,
  access: [{ binding: Project, write: false }],
  context: (goal) => AgentContext.input({ operation: "review", goal, access: "read-only" })
}

const program = Effect.gen(function*() {
  const claude = yield* ClaudeCode.configured({
    path: "config.toml",
    provider: "claude",
    overrides: {
      cwd: root,
      maxTurns: 10,
      permissionMode: "dontAsk",
      tools: [],
      settingSources: [],
      persistSession: false
    }
  })

  const observedClaude = Harness.withHooks(claude, DetailHook)

  const Reviewer = Agent
    .define<string>((task) => AgentContext.input({ operation: "review-project", task, delegation: true }))
    .returns(Until.schema(Review))
    .subagents(reviewer)
    .implementedBy(observedClaude)

  return yield* Reviewer.run("检查 src/ 下的 API 抽象一致性")
})

const review = await Effect.runPromise(program)
console.log(JSON.stringify(review.output, null, 2))
