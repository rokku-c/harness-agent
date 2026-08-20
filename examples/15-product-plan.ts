/**
 * 示例 15（Product Plan）—— 宏观 & 产品侧的规划：定位、用户、路线图、OKR、成功指标。
 *
 * 这是「工程迭代（示例 14）」的上一环：先想清楚产品层（为什么做 / 给谁做 / 往哪走），
 * 再让示例 14 去把路线图拆成可执行的工程迭代。
 *
 * 核心分工（与 14 同哲学）：
 *   - 宿主（此文件）：读取产品侧信息源（DRAFT.md 设计意图 / DESIGN.md 能力 /
 *     examples/README.md 展示 / package.json / git log），做字节上限截断后渲染给 Agent，并落盘。
 *   - Agent：产品规划者，读产品快照产出 ProductRoadmap（Schema 强制：定位、目标用户、价值主张、
 *     护城河、分阶段路线图（每阶段含里程碑与 OKR）、成功指标、产品风险、下一步产品行动）。
 *
 * 输出 `examples/generated/<phase>-product-plan.md`，其中的「下一步产品行动」可直接作为
 * `bun run example project-iterate --task <行动>` 的输入。
 *
 * 用法：
 *   bun run example product-plan                      # 采集产品快照 → 规划 → 打印 + 落盘
 *   bun run example product-plan --phase 1            # 自定义 roadmap 阶段数（默认 3）
 *   bun run example product-plan --provider reasoner
 */
import { Effect, Ref, Schema } from "effect"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import {
  Agent,
  Harness,
  Providers,
  Until
} from "effect-agent"
import { DetailHook } from "./hooks/detailed-review.js"

const exec = promisify(execFile)
const args = Bun.argv.slice(3)
const argValue = (name: string, fallback: string): string => {
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1]! : fallback
}
const providerName = (() => {
  const i = args.indexOf("--provider")
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1]! : undefined
})()
const phases = Number(argValue("--phase", "3"))
const root = resolve(import.meta.dir, "..")

/* ────────────────────────── 宿主：产品侧信息源采集 ────────────────────────── */

const MAX_DOC = 4_000 // 每个文档的最大字节数：快照只需产品意图，正文过长会让 LLM 请求体过大、网关超时
// 只取最核心的设计意图文档。IMPLEMENTATION / examples README 交给示例 14 的工程迭代去读。
const PRODUCT_FILES = ["DRAFT.md"] as const

const readCapped = (rel: string): Promise<{ ok: boolean; content: string }> =>
  stat(resolve(root, rel)).then(async (info) => {
    if (!info.isFile()) return { ok: false, content: "" }
    const size = Math.min(MAX_DOC, info.size)
    const buf = Buffer.alloc(size)
    const fd = await (await import("node:fs/promises")).open(resolve(root, rel), "r")
    try {
      await fd.read(buf, 0, size, 0)
    } finally {
      await fd.close()
    }
    return { ok: true, content: buf.toString("utf8") + (info.size > size ? "\n…（文档超长，已截断）" : "") }
  })

/** 采集产品快照：设计意图、能力、展示、包信息、最近 commit。全部字节上限截断。 */
const collectProduct = Effect.tryPromise({
  try: async () => {
    const docs = await Promise.all(PRODUCT_FILES.map((f) => readCapped(f)))
    const [pkg, log] = await Promise.all([
      readFile(resolve(root, "package.json"), "utf8").catch(() => ""),
      exec("git log --oneline -10", { cwd: root }).then((r) => r.stdout).catch(() => "")
    ])
    let pkgInfo = "package.json 不可读"
    try {
      const parsed = JSON.parse(pkg) as { name?: string; version?: string; description?: string }
      pkgInfo = `name=${parsed.name} version=${parsed.version} description=${parsed.description ?? ""}`
    } catch { /* 忽略 */ }
    return {
      docs: Object.fromEntries(PRODUCT_FILES.map((f, i) => [f, docs[i]!])),
      pkg: pkgInfo,
      gitLog: log
    }
  },
  catch: (cause) => new Error(`无法采集产品快照: ${String(cause)}`)
})

/** 渲染产品快照给 Agent（正文 + 标题目录 + 元信息）。 */
const renderProduct = (s: {
  docs: Record<string, { ok: boolean; content: string }>
  pkg: string
  gitLog: string
}): string => {
  const sections = PRODUCT_FILES.flatMap((f) => {
    const d = s.docs[f]!
    if (!d.ok) return []
    // 只保留标题，让 Agent 知道文档结构但正文限制字节。
    const headings = d.content.split("\n").filter((l) => /^#{1,3} /.test(l)).join("\n")
    return [`\n## ${f}（正文 ${d.content.length} 字符）\n\n${d.content}\n\n--- 目录 ---\n${headings}`]
  })
  return [
    `# 产品快照\n\n## 包\n${s.pkg}\n\n## 最近 commit\n${s.gitLog || "(无)"}`,
    ...sections,
    `\n> 请基于以上产品信息做宏观产品规划，不要臆造数据。`
  ].join("\n")
}

/* ────────────────────────── 产品规划 Agent ────────────────────────── */

const Phase = Schema.Struct({
  name: Schema.String,
  goal: Schema.String,
  milestones: Schema.Array(Schema.String),
  okrs: Schema.Array(Schema.String)
})

const ProductRoadmap = Schema.Struct({
  positioning: Schema.String,
  targetUsers: Schema.Array(Schema.String),
  valueProps: Schema.Array(Schema.String),
  moat: Schema.String,
  phases: Schema.Array(Phase),
  successMetrics: Schema.Array(Schema.String),
  productRisks: Schema.Array(Schema.String),
  nextActions: Schema.Array(Schema.String)
})

const makeProductPlanner = (driver: ReturnType<typeof Harness.withHooks>, phaseCount: number) =>
  Agent
    .define<string>()
    .returns(Until.schema(ProductRoadmap))
    .implementedBy(driver)

/* ────────────────────────── 宿主：落盘产品规划 ────────────────────────── */

const writePlan = (plan: typeof ProductRoadmap.Type, phaseCount: number) =>
  Effect.tryPromise({
    try: async () => {
      const dir = resolve(import.meta.dir, "generated")
      await mkdir(dir, { recursive: true })
      const path = resolve(dir, "product-plan.md")
      const md = [
        `# effect-agent 产品路线图`,
        ``,
        `## 定位`,
        plan.positioning,
        ``,
        `## 目标用户`,
        ...plan.targetUsers.map((u) => `- ${u}`),
        ``,
        `## 价值主张`,
        ...plan.valueProps.map((v) => `- ${v}`),
        ``,
        `## 护城河`,
        plan.moat,
        ``,
        `## 分阶段路线图（${phaseCount} 阶段）`,
        ...plan.phases.flatMap((p, i) => [
          `### P${i + 1} ${p.name}`,
          `- goal: ${p.goal}`,
          `- milestones:`,
          ...p.milestones.map((m) => `  - ${m}`),
          `- OKRs:`,
          ...p.okrs.map((o) => `  - ${o}`),
          ``
        ]),
        `## 成功指标`,
        ...plan.successMetrics.map((m) => `- ${m}`),
        ``,
        `## 产品风险`,
        ...plan.productRisks.map((r) => `- ${r}`),
        ``,
        `## 下一步产品行动`,
        ...plan.nextActions.map((a) => `- ${a}`),
        ``
      ].join("\n")
      await writeFile(path, md, "utf8")
      return path
    },
    catch: (cause) => new Error(`无法写入产品规划: ${String(cause)}`)
  })

/* ────────────────────────── 主流程 ────────────────────────── */

const program = Effect.gen(function*() {
  const providers = yield* Providers
  const native = providers.agent(providerName)
  const observed = Harness.withHooks(native, DetailHook)
  const planner = makeProductPlanner(observed, phases)

  const snapshot = yield* collectProduct
  const plan = (yield* planner.run(`[plan-product] 阶段数 ${phases}\n\n${renderProduct(snapshot)}`)).output
  const path = yield* writePlan(plan, phases)

  return { plan, path }
})

const { plan, path } = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" }))) as never
) as unknown as { plan: typeof ProductRoadmap.Type; path: string }

console.log("\n=== 产品定位 ===")
console.log(plan.positioning)
console.log("\n=== 目标用户 ===")
plan.targetUsers.forEach((u) => console.log(`- ${u}`))
console.log("\n=== 分阶段路线图 ===")
plan.phases.forEach((p, i) => console.log(`P${i + 1} ${p.name}: ${p.goal}`))
console.log("\n=== 成功指标 ===")
plan.successMetrics.forEach((m) => console.log(`- ${m}`))
console.log("\n=== 下一步产品行动 ===")
plan.nextActions.forEach((a) => console.log(`- ${a}`))
console.log(`\n已落盘: ${path}`)
