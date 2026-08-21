import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 4 —— Claude Code adapter（connection 分类）。
 *
 * 具体 driver 是 Agent，它连接的 connection 自带 use 标记：provider（模型配置）、
 * tool（注入为工具）、skill（注入为技能）。agent 的一个 control 声明影响这些世界。
 *
 * 运行：bun packages/ioecc/examples/04-claude-adapter.ts
 */

/* ── Connection 分类：use 标记是 connection 自己的属性 ── */
const providerConn = { name: "anthropic", use: "provider" }
const toolsConn    = { name: "fs",        use: "tool" }
const skillsConn   = { name: "review",    use: "skill" }

/* ── 一个 Control：经 Claude 相关 connection 交互 ── */
class RunClaude extends Control<string, string> {
  readonly input = Schema.String
  readonly output = Schema.String
  constructor() { super("RunClaude", ["Claude"]) }
  run(i: string, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<string, Error> {
    return impls.get("Claude")!.handle("run", i) as Effect.Effect<string, Error>
  }
}

/* ── Claude driver：Agent，连接三类 connection + 声明分类 ── */
const claudeDriver = {
  connections: ["anthropic", "fs", "review"],
  controls: [new RunClaude()],
  drivers: [],
  // 具体 driver 的分类映射（connection use 标记）
  classify: [providerConn, toolsConn, skillsConn],
}

const program = EffectAgent.gen({
  connections: ["Claude"],
  controls: [new RunClaude()],
}, [claudeDriver], new Map<string, ConnectionImpl>([
  ["Claude", { handle: (op, args) => Effect.succeed(`[claude] ${String(args)}`) }],
]))

console.log("=== Claude Code adapter ===")
console.log("connection 分类:")
for (const c of claudeDriver.classify) console.log(`  ${c.name.padEnd(10)} → ${c.use}`)

const out = await Effect.runPromise(program.drive(0, "review this code")) as string
console.log("经 Claude →", out)
