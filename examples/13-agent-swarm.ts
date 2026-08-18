/**
 * 示例 13（Agent Swarm）—— 多角色扇出 → 有界并发 → 失败隔离 → 监督合并。
 *
 * 这是「大规模任务」的实战形态：同一个任务交给多个「角色各异的 Agent」并行产出独立方案，
 * 再用一个监督 Agent 把所有人的结论合并成一份最终计划。架构与 10-blackboard 的收敛模式同源，
 * 但强调 swarm 特有的三个工程点：
 *
 *   1. 扇出：每个角色一个 Agent 定义（独立 system，避免互相影响）。
 *   2. 有界并发：Effect.forEach(..., { concurrency: <n> })——Agent.map 是无界并发，真实规模下
 *      会打爆 API 速率限制与成本预算。
 *   3. 失败隔离：Effect.either 包每个子任务——单个 Agent 失败不拖垮整个 swarm，最终汇总时
 *      明确区分 successes / failures。
 *
 * 角色扇出后，监督 Agent 用 Schema 强制的 SupervisorVerdict 判定收敛 / 继续 / 僵局。
 *
 * 用法：
 *   bun run example agent-swarm --task "如何设计一个安全且容易理解的工具权限系统？"
 *   bun run example agent-swarm --task "<你的问题>" --provider reasoner --concurrency 3 --roles architect,security,performance
 *   bun run example agent-swarm                                  # 用内置示例任务
 */
import { Effect, Schema } from "effect"
import {
  Agent,
  AgentContext,
  Harness,
  Providers,
  Until,
  type Result
} from "effect-agent"
import { DetailHook } from "./hooks/detailed-review.js"
import { TOOLS, readDocsBinding } from "./lib/agent-spec.js"

/* ────────────────────────── CLI 参数解析 ────────────────────────── */

const args = Bun.argv.slice(3)
const argValue = (name: string, fallback: string): string => {
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1]! : fallback
}

const task = argValue("--task", "如何为一个 coding agent 设计安全且容易理解的工具权限系统？")
// 未传 --provider 时用 undefined，让 Providers.agent 回落 config.toml 的 default。
const providerName = (() => {
  const i = args.indexOf("--provider")
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1]! : undefined
})()
const concurrency = Number(argValue("--concurrency", "3"))
const roleNames = argValue("--roles", "architect,security,performance").split(",").map((s) => s.trim()).filter(Boolean)
/* ────────────────────────── 角色定义 ────────────────────────── */

const PERSPECTIVES: Record<string, ReadonlyArray<string>> = {
  architect: ["architecture", "boundaries", "tradeoffs"],
  security: ["threats", "access-control", "mitigations"],
  performance: ["bottlenecks", "scalability", "cost"],
  maintainer: ["maintenance", "evolution", "compatibility"]
}

const Proposal = Schema.Struct({
  approach: Schema.String,
  advantages: Schema.Array(Schema.String),
  concern: Schema.String
})

/** 每个角色 Agent 共享同一份只读绑定（可让角色读到框架文档/示例作参考）。 */
const makeRoleAgent = (perspective: string, focus: ReadonlyArray<string>, driver: ReturnType<typeof Harness.withHooks>) =>
  Agent
    .define<string>((task) => AgentContext.input({ operation: "propose", task, perspective, focus }))
    .returns(Until.schema(Proposal))
    .uses(readDocsBinding)
    .implementedBy(driver)

/* ────────────────────────── 监督 Agent ────────────────────────── */

const SupervisorVerdict = Schema.Struct({
  decision: Schema.Literal("converge", "continue", "stuck"),
  reasoning: Schema.String,
  finalPlan: Schema.String
})

const makeSupervisor = (driver: ReturnType<typeof Harness.withHooks>) =>
  Agent
    .define<string>((proposals) => AgentContext.input({ operation: "consolidate", proposals }))
    .returns(Until.schema(SupervisorVerdict))
    .implementedBy(driver)

/* ────────────────────────── 主流程 ────────────────────────── */

const program = Effect.gen(function*() {
  const providers = yield* Providers
  const native = providers.agent(providerName)
  const observed = Harness.withHooks(native, DetailHook)

  // 1) 扇出：为每个角色建立 Agent，共享同一个驱动。
  const roleAgents = roleNames
    .filter((name) => PERSPECTIVES[name])
    .map((name) => makeRoleAgent(name, PERSPECTIVES[name]!, observed))

  if (roleAgents.length === 0) return yield* Effect.fail(new Error(`没有可用的角色: ${roleNames.join(",")}`))

  // 2) 并行：有界并发 + 失败隔离（Effect.either）。
  const results = yield* Effect.forEach(
    roleAgents,
    (agent, index) => agent.run(task).pipe(Effect.either),
    { concurrency }
  )

  // 归并：用 Effect.forEach + 不可变累积，而不是 let + push。
  const { successes, failures } = yield* Effect.forEach(
    results,
    (entry, i) => Effect.sync(() => entry._tag === "Right"
      ? ({ successes: [entry.right] as const, failures: [] as const })
      : ({ successes: [] as const, failures: [{ role: roleNames[i]!, cause: entry.left }] as const })),
    { concurrency: "unbounded" }
  ).pipe(Effect.map((chunks) => chunks.reduce<{
    successes: ReadonlyArray<Result<typeof Proposal.Type>>
    failures: ReadonlyArray<{ role: string; cause: unknown }>
  }>(
    (acc, chunk) => ({
      successes: [...acc.successes, ...chunk.successes],
      failures: [...acc.failures, ...chunk.failures]
    }),
    { successes: [], failures: [] }
  )))

  // 3) 协调：把每个成功提案渲染成监督的输入；失败的角色用占位注明。
  const render = (r: Result<typeof Proposal.Type>) =>
    `方案: ${r.output.approach}\n  优点: ${r.output.advantages.join("、")}\n  顾虑: ${r.output.concern}`
  const renderAll = [
    ...successes.map((r, i) => `[角色 ${roleNames[i]}] ${render(r)}`),
    ...failures.map((f, i) => `[角色 ${f.role}]（该角色 Agent 失败: ${String(f.cause)}）`)
  ].join("\n\n")

  const supervisor = makeSupervisor(observed)
  const verdict = yield* supervisor.run(
    `本轮 swarm 的所有提案如下：\n\n${renderAll}\n\n请判定收敛并给出最终计划。`
  )

  return { successes: successes.length, failures: failures.length, verdict: verdict.output }
})

const out = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" }))) as never
) as unknown as {
  successes: number
  failures: number
  verdict: { decision: string; reasoning: string; finalPlan: string }
}

console.log(`\n=== swarm 结果 (task: ${task}) ===`)
console.log(`角色: ${roleNames.join(", ")}  concurrency=${concurrency}`)
console.log(`成功 ${out.successes} / 失败 ${out.failures}`)
console.log(`\n=== 监督判定 ===`)
console.log(`decision: ${out.verdict.decision}`)
console.log(`reasoning: ${out.verdict.reasoning}`)
console.log(`\n=== 最终计划 ===\n${out.verdict.finalPlan}`)
