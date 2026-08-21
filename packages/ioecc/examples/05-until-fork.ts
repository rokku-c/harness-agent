import { Effect, Schema } from "effect"
import { Until, runUntil } from "../builtin/index.js"

/**
 * IOECC 示例 5 —— until + fork。
 *
 * 跑 Claude Code，直到某个观察点（第一个 thinking / 输出符合 schema / 文本），
 * 就在那 fork 出一个子 agent/session 处理中间状态，主 agent 继续跑。
 *
 * 真实 SDK 调用需 ANTHROPIC_API_KEY；未配置时优雅降级。
 *
 * 运行：bun packages/ioecc/examples/05-until-fork.ts
 */

const ReviewSchema = Schema.Struct({
  summary: Schema.String,
  verdict: Schema.Literal("ok", "needs-work"),
})

// 直到「输出符合 ReviewSchema」就 fork：把命中的中间状态交给子任务汇报。
const program = runUntil(
  "审查这段代码并给出结构化结论",
  Until.schema(ReviewSchema),
  {
    options: { model: "claude-opus" },
    fork: (messages, matched) =>
      Effect.sync(() => {
        // 在 until 边界 fork：这里演示「派生子 agent 汇报进度」。
        // 真实场景：把 messages/matched 传给另一个 agent/session 继续处理。
        console.log(`  [fork] 在 ${matched.type} 消息处派生子任务（已收 ${messages.length} 条消息）`)
        return "forked: child agent reported progress"
      }),
  }
)

console.log("=== until + fork ===")
console.log("until: 输出符合 ReviewSchema 就 fork\n")

const result = await Effect.runPromise(program.pipe(Effect.either))
if (result._tag === "Right") {
  console.log("fork 触发:", result.right.forked ? "是 ✓" : "否")
  console.log("最终输出:", JSON.stringify(result.right.output))
} else {
  console.log("（真实调用需 ANTHROPIC_API_KEY）")
  console.log("  错误:", String(result.left).slice(0, 100))
}
