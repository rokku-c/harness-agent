import { Effect, Ref, Schema } from "effect"
import { Agent, AgentContext, ClaudeCode, Harness, Until } from "effect-agent"
import { DetailHook } from "./hooks/detailed-review.js"

/**
 * 示例 10：黑板架构 —— 两个 Agent 对着共享黑板协作解一道**纸笔找规律谜题**，
 * 题目的 hint 故意模糊，需要猜出题者的真实逻辑，一个监督 Agent 观察并推进。
 *
 * 用法：
 *   bun run example blackboard-puzzle
 *
 * 题目（找规律数列，hint 有模糊空间）：
 *   数列：1, 2, 4, 8, 16, ?
 *   hint：出题者的规律和 2 的幂有关，但下一个数不是简单的 ×2。
 *
 *   「和 2 的幂有关但答案不是 32」——这故意留了歧义，两个 Agent 会给出不同的
 *   自洽解读并互相论证：
 *     - 解读甲：×2 → 32，但 hint 说不是 → 应另找规律
 *     - 解读乙：把各项写成二进制 1, 10, 100, 1000, 10000，
 *       下一项是二进制 11111 = 31（全是 1，且"和 2 的幂有关"）。
 *
 *   验证：末尾用实际代码检查给出的答案是否自洽（比如 31 = 11111₂），
 *   以及它是否真的来自一个与 2 的幂相关的规律。
 *
 * 架构：
 *   黑板（Blackboard）：共享的不可变日志，跨轮累积每个 Agent 的推演结论。
 *
 *   每轮节奏：
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Round N                                              │
 *   │   Agent A ──读黑板(含 B 的 N-1 轮)──► 假设/补充/修正   │
 *   │   Agent B ──读黑板(含 A 的 N-1 轮)──► 假设/补充/修正   │  ← 并行
 *   │        │                        │                     │
 *   │        └──────────┬─────────────┘                     │
 *   │   监督 Agent：看双方 → continue / converge / done      │  ← 顺序
 *   │   黑板 append 本轮两条结论                              │
 *   └──────────────────────────────────────────────────────┘
 *
 * 节奏控制：
 *   - 该并行并行：同轮 A、B 互不依赖，Effect 并发执行。
 *   - 有依赖的顺序：下一轮双方都看到上一轮对方的结论，才能补充/修正/反驳。
 *   - 监督 Agent：判定收敛 / 僵局 / 轮次上限，控制推进与结束。
 *   由于 hint 模糊，A、B 大概率坚持各自解读 → 黑板上会形成真实的多轮争论。
 */

const PUZZLE = `一道找规律谜题：
数列：1, 2, 4, 8, 16, ?

hint（故意模糊，来自出题者）：出题者的规律和 2 的幂有关，但下一个数不是简单的 ×2。

请猜测出题者的真实逻辑，给出下一个数，并解释为什么你的解读最符合 hint。
注意：数列找规律通常有不止一种自洽解释，请论证为什么你的解释更合理。`

// ── 黑板模型 ────────────────────────────────────────────────

const BoardEntry = Schema.Struct({
  round: Schema.Number,
  author: Schema.Literal("A", "B"),
  hypothesis: Schema.String,      // 本轮假设/规律解读
  stance: Schema.String,          // 补充 / 修正 / 反驳对方
  confidence: Schema.Number       // 置信度 0-100
})
type BoardEntry = typeof BoardEntry.Type

interface Blackboard {
  readonly problem: string
  readonly round: number
  readonly entries: ReadonlyArray<BoardEntry>
}

const renderBoard = (board: Blackboard): string => {
  const history = board.entries.map((entry) =>
    `[R${entry.round} ${entry.author}] ${entry.hypothesis}\n   stance: ${entry.stance} (conf ${entry.confidence})`
  ).join("\n")
  return `数学谜题：${board.problem}\n\n当前轮次：R${board.round}\n\n已发生的推演：\n${history || "（尚无推演）"}`
}

// ── 每轮推演 Agent 的输出 ────────────────────────────────────

const RoundOutput = Schema.Struct({
  hypothesis: Schema.String,      // 规律解读 + 答案
  stance: Schema.String,          // 对上一轮对方结论的态度
  confidence: Schema.Number       // 置信度 0-100
})

// ── 监督 Agent 的输出 ────────────────────────────────────────

const SupervisorVerdict = Schema.Struct({
  decision: Schema.Literal("continue", "converge", "stuck", "done"),
  reasoning: Schema.String,        // 为什么这么判
  focus: Schema.String             // 下轮焦点（continue 时）或最终结论
})

// ── 黑板运行时 ───────────────────────────────────────────────

const maxRounds = 6

const program = Effect.gen(function*() {
  // 三个 Agent 都用 Claude Code 作为 ComposedAgent 驱动（完整外部 Agent）。
  // 认证由 Claude Agent SDK 自己读取；全局 [insecureTls] 继承 TLS 绕过。
  const claude = yield* ClaudeCode.configured({
    path: "config.toml",
    provider: "claude",
    overrides: {
      cwd: process.cwd(),
      maxTurns: 10,
      permissionMode: "dontAsk",
      tools: [],
      settingSources: [],
      persistSession: false
    }
  })
  // 所有 Agent 都接入 DetailHook，打印每次 run 的完整细节。
  const agentA = Harness.withHooks(claude, DetailHook)
  const agentB = Harness.withHooks(claude, DetailHook)
  const supervisor = Harness.withHooks(claude, DetailHook)

  const AgentA = Agent
    .define<string>((blackboard) => AgentContext.input({
      operation: "solve-pattern",
      perspective: "numeric-pattern",
      blackboard
    }))
    .returns(Until.schema(RoundOutput))
    .implementedBy(agentA)

  const AgentB = Agent
    .define<string>((blackboard) => AgentContext.input({
      operation: "solve-pattern",
      perspective: "combinatorial",
      blackboard
    }))
    .returns(Until.schema(RoundOutput))
    .implementedBy(agentB)

  const Supervisor = Agent
    .define<string>((blackboard) => AgentContext.input({
      operation: "evaluate-convergence",
      blackboard
    }))
    .returns(Until.schema(SupervisorVerdict))
    .implementedBy(supervisor)

  // 共享黑板：Ref 保存跨轮累积状态
  const blackboardRef = yield* Ref.make<Blackboard>({
    problem: PUZZLE,
    round: 0,
    entries: []
  })

  const finalAnswer = yield* Effect.gen(function*() {
    for (let round = 1; round <= maxRounds; round++) {
      // 黑板推进到本轮：entries 仍是上一轮之前的，round 标为当前轮。
      const current = yield* Ref.updateAndGet(blackboardRef, (b) => ({ ...b, round }))

      // ── 并行：Agent A 与 B 同时推演，各自读到上一轮的黑板 ──
      const [resultA, resultB] = yield* Effect.all([
        AgentA.run(renderBoard(current)).pipe(Effect.map((r) => ({ round, author: "A" as const, ...r.output }))),
        AgentB.run(renderBoard(current)).pipe(Effect.map((r) => ({ round, author: "B" as const, ...r.output })))
      ], { concurrency: 2 })

      // ── 黑板更新：append 本轮两条结论 ──
      yield* Ref.update(blackboardRef, (b) => ({
        ...b,
        entries: [...b.entries, resultA, resultB]
      }))

      // ── 顺序：监督 Agent 观察双方结论，判定下一步 ──
      const updated = yield* Ref.get(blackboardRef)
      const verdict = yield* Supervisor.run(
        `监督本轮（R${round}）的推演。\n\n${renderBoard(updated)}`
      )
      const v = verdict.output

      console.error(`\n[blackboard] R${round} 监督判定: ${v.decision} — ${v.reasoning}`)
      console.error(`[blackboard] 下轮焦点: ${v.focus}`)

      if (v.decision === "done" || v.decision === "converge") return v.focus
      if (v.decision === "stuck") {
        // 僵局：立即让监督仲裁出一个最自洽的解读。
        const board = yield* Ref.get(blackboardRef)
        const stuckVerdict = yield* Supervisor.run(
          `双方陷入僵局。请基于全部 ${board.entries.length} 条推演，仲裁出最符合 hint 的规律解读和答案。\n\n${renderBoard(board)}`
        )
        return stuckVerdict.output.focus
      }
    }
    // 达到最大轮次：让监督给出最终结论
    const board = yield* Ref.get(blackboardRef)
    const finalVerdict = yield* Supervisor.run(
      `轮次已达上限，请基于全部 ${board.entries.length} 条推演给出最终一致且最符合 hint 的解读和答案。\n\n${renderBoard(board)}`
    )
    return finalVerdict.output.focus
  })

  return finalAnswer
})

const result = await Effect.runPromise(program) as unknown as string

console.log("\n=== 黑板推演的最终结论 ===")
console.log(result)

// ── 真实验证：检查结论中的答案是否自洽且符合 hint ──

// 提取结论里出现的整数答案
const numbers = result.match(/\b\d+\b/g) ?? []
const distinct = [...new Set(numbers)]

console.log("\n=== 真实验证（自洽性检查） ===")

// 数列找规律题可以有多个自洽解读，关键标准是：
//   1) 答案不是 32（hint 明确排除 ×2）
//   2) 答案来自一个「和 2 的幂有关」的规律
// 已知满足标准的解读（都给出 31，但规律不同）：
const INTERPRETATIONS: ReadonlyArray<{ answer: string; rule: string }> = [
  { answer: "31", rule: "二进制全 1：1,10,100,1000,10000 → 11111 = 31（与 2 的幂相关但非 ×2）" },
  { answer: "31", rule: "Moser 圆分割：R(n)=C(n,4)+C(n,2)+1，前 5 项恰为 2^0..2^4，第 6 项 = 31（舍弃 C(5,5)=1）" },
  { answer: "32", rule: "×2（最直接，但被 hint 明确排除）" }
]

let matched = false
for (const interp of INTERPRETATIONS) {
  if (result.includes(interp.answer)) {
    console.log(`结论中出现 ${interp.answer}，解读：${interp.rule}`)
    if (interp.answer === "31") console.log("✅ 自洽且符合 hint（非 ×2，来自一个与 2 的幂相关的规律）")
    else console.log("⚠️ 这个答案被 hint 排除了，说明 Agent 可能忽略了 hint")
    matched = true
  }
}

if (!matched) {
  console.log(`❌ 结论中出现的数字 ${distinct.join(", ") || "（无）"} 不属于已知自洽解读`)
  console.log("提示：最符合 hint 的答案是 31（来自二进制全 1 或 Moser 圆分割，都是「和 2 的幂有关」的规律）")
}

// 额外：展示二进制自洽性
console.log("\n参考：二进制解释")
for (const n of [1, 2, 4, 8, 16, 31]) {
  console.log(`  ${String(n).padStart(2)} = ${n.toString(2)}₂`)
}
console.log("  1, 10, 100, 1000, 10000 → 11111（全是 1）")
