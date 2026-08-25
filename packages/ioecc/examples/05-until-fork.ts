import { Effect, Schema } from "effect"
import { Until, configuredClaudeCode, runUntil } from "../builtin/index.js"

/**
 * IOECC 示例 5 —— until + fork（真实 SDK）。
 *
 * 跑 Claude Code（config.toml 的 claude provider），直到输出符合 ReviewSchema，
 * 就在那 fork 出一个子 agent/session 汇报中间状态，主 agent 继续跑。
 *
 * 运行：bun run ioecc:example until-fork
 */

const ReviewSchema = Schema.Struct({
  summary: Schema.String,
  verdict: Schema.Literal("ok", "needs-work"),
})

const program = Effect.gen(function* () {
  // 从 config.toml + .env 读 provider，构造已配置 driver。
  const claude = yield* configuredClaudeCode({
    path: "config.toml",
    provider: "claude",
    providerConnection: { name: "claude", use: "provider" },
  })

  // 直到「输出符合 ReviewSchema」就 fork。
  return yield* runUntil(
    "请直接给出审查结论，严格返回 JSON：{ \"summary\": \"<一句话摘要>\", \"verdict\": \"ok\" 或 \"needs-work\" }，不要输出其他内容。",
    Until.schema(ReviewSchema),
    {
      options: claude.sdkOptions,
      fork: (messages, matched) =>
        Effect.sync(() => {
          console.log(`  [fork] 在 ${matched.type} 消息处派生子任务（已收 ${messages.length} 条消息）`)
          return "forked: child agent reported progress"
        }),
    }
  )
})

console.log("=== until + fork（真实 Claude Code） ===")
console.log("until: 输出符合 ReviewSchema 就 fork\n")

const result = await Effect.runPromise(program.pipe(Effect.either))
if (result._tag === "Right") {
  console.log("fork 触发:", result.right.forked ? "是 ✓" : "否")
  console.log("最终输出:", JSON.stringify(result.right.output))
} else {
  console.log("  错误:", String(result.left).slice(0, 150))
}
