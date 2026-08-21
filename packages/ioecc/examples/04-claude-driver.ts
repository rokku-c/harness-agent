import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"
import { makeClaudeCodeDriver, RunClaude } from "../builtin/index.js"

/**
 * IOECC 示例 4 —— Claude Code driver（builtin）。
 *
 * 用 builtin 的 ClaudeCode driver：它是 Agent（connections + controls + run）。
 * connection 分类（provider/tool/skill）由 driver 的 classify 声明。
 * agent 的 RunClaude control 经 Claude connection 交互。
 *
 * 运行：bun packages/ioecc/examples/04-claude-driver.ts
 */

/* ── Claude Code driver（builtin） ── */
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

const out = await Effect.runPromise(program.drive(0, "review this code")) as string
console.log("\n=== 经 Claude driver 运行 ===")
console.log(out)
