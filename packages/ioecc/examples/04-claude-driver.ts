import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"
import { makeClaudeCodeDriver, RunClaude } from "../builtin/index.js"

/**
 * IOECC 示例 4 —— Claude Code driver（builtin，真实 SDK）。
 *
 * driver 是 Agent（connections + controls + run），run 调真实 Claude Agent SDK
 * （query 收集消息，取 result）。connection 分类（provider/tool/skill）由 classify 声明。
 *
 * 真实调用需要配置 ANTHROPIC_API_KEY（或 .claude 认证）；未配置时 drive 会失败，
 * 这里用 Effect.either 优雅捕获并说明。
 *
 * 运行：bun packages/ioecc/examples/04-claude-driver.ts
 */

/* ── Claude Code driver（builtin，真实 SDK） ── */
const claude = makeClaudeCodeDriver({
  model: "claude-opus",
  providerConnection: { name: "anthropic", use: "provider" },
  toolConnections: [{ name: "fs", use: "tool" }],
  skillConnections: [{ name: "review", use: "skill" }],
})

/* ── agent：经 claude driver 的 RunClaude control 交互 ── */
const program = EffectAgent.gen({
  connections: ["Claude"],
  controls: [new RunClaude()],
}, [claude], new Map<string, ConnectionImpl>([
  ["Claude", claude.toImpl()],
]))

console.log("=== Claude Code driver ===")
console.log("connection 分类:")
for (const c of claude.classify) console.log(`  ${c.name.padEnd(10)} → ${c.use}`)
console.log("driver controls:", claude.controls.map((c) => c._tag).join(", "))

// 真实 SDK 调用：需要 ANTHROPIC_API_KEY。用 either 优雅捕获失败。
const result = await Effect.runPromise(
  program.drive(0, "review this code").pipe(Effect.either)
)
console.log("\n=== 经 Claude driver 运行 ===")
if (result._tag === "Right") {
  console.log(result.right)
} else {
  console.log("（真实调用需 ANTHROPIC_API_KEY）")
  console.log("  错误:", String(result.left).slice(0, 120))
  console.log("  结构验证 ✓：driver 是 Agent，connections/controls/run 已接真实 SDK")
}
