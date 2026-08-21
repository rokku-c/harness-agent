import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 5 —— Claude Code adapter（具体 driver）。
 *
 * 声明一个 Claude Code driver：它是一个 Agent（五维度），附加自己的元数据。
 * connection 的分类（哪些作为 provider 配置 / 注入为工具 / 注入为 skills）
 * 由 driver 的 use 标记声明；agent 的 connections 仍是名字列表。
 * 这只是「声明如何设置」，不真的起 Claude Code。
 * 影响声明绑定在 Control 上（affects）：RunClaude 声明影响 Claude/fs/review。
 *
 * 运行：bun packages/ioecc/examples/05-claude-adapter.ts
 */

/* ── Connection 用途标记（connection 自己声明是 provider / tool / skill） ── */
type UseMark = { name: string; use: "provider" | "tool" | "skill" }
const useMarks: UseMark[] = [
  { name: "anthropic", use: "provider" },
  { name: "fs",        use: "tool" },
  { name: "review",    use: "skill" },
]

/* ── Claude Code driver —— 一个 Agent，连接上面三个 connection（五维度无 intents） ── */
const claudeCodeDriver = {
  input: Schema.String,
  output: Schema.String,
  connections: useMarks.map((c) => c.name),          // 需要的世界：anthropic/fs/review
  controls: [],
  drivers: [],
  // 具体 driver 能力元数据：分类这些 connection 的用途。
  useMarks,
}

/* ── Claude 运行实现（fake，不真调 API）：注入为 Claude/fs/review impls ── */
const runImpl: ConnectionImpl = {
  handle: (op, args) => Effect.succeed(`[claude] ${String(args)}`),
}

/* ── 主 agent：经 claude driver 跑（RunClaude 影响 Claude + 注入的工具/worlds） ── */
class RunClaude<I, O> extends Control<I, O> {
  constructor() { super("RunClaude", ["Claude", "fs", "review"]) }
  run(_i: I, _o: O, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error> {
    const claude = impls.get("Claude")!
    return claude.handle("run", _i) as Effect.Effect<O, Error>
  }
}

const program = EffectAgent.gen({
  input: Schema.String,
  output: Schema.String,
  connections: ["Claude", "fs", "review"],
  controls: [new RunClaude<string, string>()],
}, [claudeCodeDriver], new Map([
  ["Claude", runImpl],
  ["fs", { handle: () => Effect.succeed(undefined) }],
  ["review", { handle: () => Effect.succeed(undefined) }],
]))

console.log("=== Claude Code adapter ===")
console.log("driver 是 Agent（五维度），连接的 connection:")
for (const c of claudeCodeDriver.useMarks)
  console.log(`  ${c.name.padEnd(10)} → ${c.use}`)

const out = await Effect.runPromise(program.drive(0, "review this code")) as string
console.log("\n=== 经 Claude driver 运行（RunClaude 经 impls 访问影响的世界） ===")
console.log(out)
