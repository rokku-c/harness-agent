import { Effect, Schema } from "effect"
import { glob } from "node:fs/promises"
import { readFile, stat } from "node:fs/promises"
import { relative, resolve, sep } from "node:path"
import {
  Agent,
  ClaudeCode,
  Harness,
  Op,
  Until,
  Uri,
  type Binding
} from "effect-agent"
import { DetailHook } from "./hooks/detailed-review.js"

const root = process.cwd()
const ignored = new Set([".git", "node_modules", "dist", "build", "coverage"])
const maxFilesRead = 24
let filesRead = 0

const insideRoot = (path: string) => {
  const target = resolve(root, path)
  if (target !== root && !target.startsWith(root + sep)) throw new Error(`Path escapes project: ${path}`)
  return target
}

const ListFiles = Op.read({
  name: "project.listFiles",
  description: "列出当前项目中的源代码和配置文件。可以用 glob 参数缩小范围。",
  input: Schema.Struct({
    pattern: Schema.optionalWith(Schema.String, { default: () => "**/*" })
  }),
  output: Schema.Array(Schema.String),
  execute: ({ pattern }) => Effect.tryPromise({
    try: async () => {
      const files: string[] = []
      for await (const path of glob(pattern, { cwd: root, exclude: [...ignored].map((name) => `${name}/**`) })) {
        const target = insideRoot(path)
        if ((await stat(target)).isFile()) files.push(relative(root, target))
        if (files.length >= 250) break
      }
      return files.sort()
    },
    catch: (cause) => new Error(`Unable to list project files: ${String(cause)}`)
  })
})

const ReadFile = Op.read({
  name: "project.readFile",
  description: `读取当前项目中的一个 UTF-8 文本文件。只能读取项目目录内、最大 256 KiB 的文件；本次审查最多读取 ${maxFilesRead} 个文件。`,
  input: Schema.Struct({ path: Schema.String }),
  output: Schema.String,
  execute: ({ path }) => Effect.tryPromise({
    try: async () => {
      if (filesRead >= maxFilesRead)
        throw new Error(`Review read budget exhausted (${maxFilesRead} files). Stop exploring and return the review now.`)
      filesRead += 1
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

const Finding = Schema.Struct({
  severity: Schema.Literal("critical", "high", "medium", "low"),
  file: Schema.String,
  line: Schema.optional(Schema.Number),
  title: Schema.String,
  evidence: Schema.String,
  recommendation: Schema.String
})

const Review = Schema.Struct({
  summary: Schema.String,
  findings: Schema.Array(Finding),
  strengths: Schema.Array(Schema.String),
  filesReviewed: Schema.Array(Schema.String)
})

const program = Effect.gen(function*() {
  const claude = yield* ClaudeCode.configured({
    path: "config.toml",
    provider: "claude",
    overrides: {
      cwd: root,
      maxTurns: 20,
      permissionMode: "dontAsk",
      tools: [],
      skillPaths: ["examples/skills/project-review"],
      skills: ["project-review"],
      settingSources: [],
      persistSession: false,
      // 仅在显式设置环境变量时覆盖 config.toml 中的 insecureTls；
      // 未设置时交给配置（composedAgents.* 或全局 [insecureTls]）决定。
      // ...(Bun.env.REVIEW_INSECURE_TLS !== undefined
      //   ? { insecureTls: Bun.env.REVIEW_INSECURE_TLS === "1" }
      //   : {})
    }
  })

  const observedClaude = Harness.withHooks(claude, DetailHook)

  const ProjectReviewer = Agent
    .define<string>()
    .returns(Until.schema(Review))
    .uses(Project)
    .implementedBy(observedClaude)

  return yield* ProjectReviewer.run(
    "API 抽象是否一致、Effect 依赖是否正确、能力声明是否真实，以及安全边界是否可靠"
  )
})

const review = await Effect.runPromise(program)
console.log(JSON.stringify(review.output, null, 2))
