import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"
import { detailOf, makeClaudeCodeDriver, makeClaudeDetail } from "../builtin/index.js"

/**
 * IOECC 示例 6 —— 把 Claude Code 内部 detail 暴露为 Connection。
 *
 * driver 运行时把每条 SDK 消息的 detail（thinking/text/tool_use/result）写入共享 Ref；
 * 一个「读 detail」的 agent 声明影响 ClaudeDetail Connection，读取内部过程。
 * 观测 = 具体 driver 作为普通 Connection 注入。
 *
 * 运行：bun packages/ioecc/examples/06-claude-detail.ts
 */

/* ── ClaudeDetail Connection：收集 + 读取 ── */
const detail = makeClaudeDetail()

/* ── Claude Code driver：运行时把 detail 写入 detail.ref ── */
const claude = makeClaudeCodeDriver({
  model: "claude-opus",
  providerConnection: { name: "anthropic", use: "provider" },
  onMessage: (message) => detail.record(message),   // 每条 SDK 消息 → detail
})

/* ── 一个「读 detail」的 control：影响 ClaudeDetail ── */
class ReadDetail extends Control<void, unknown> {
  readonly input = Schema.Void
  readonly output = Schema.Unknown
  constructor() { super("ReadDetail", ["ClaudeDetail"]) }
  run(_i: void, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<unknown, Error> {
    return impls.get("ClaudeDetail")!.handle("list", undefined)
  }
}

/* ── 读 detail 的 agent ── */
const detailAgent = EffectAgent.gen({
  connections: ["ClaudeDetail"],
  controls: [new ReadDetail()],
}, [], new Map<string, ConnectionImpl>([
  ["ClaudeDetail", detail.impl],
]))

console.log("=== Claude detail Connection ===")

// 模拟一条 SDK assistant 消息（含 thinking/text/tool_use），验证 detail 抽取 + 读取。
const sample = {
  type: "assistant",
  message: { content: [
    { type: "thinking", thinking: "分析中..." },
    { type: "text", text: "初步结论" },
    { type: "tool_use", id: "t1", name: "readFile", input: { path: "a.ts" } },
  ] },
} as never

// 1. driver 记录 detail（真实运行时每条消息都会经过 onMessage）。
await Effect.runPromise(detail.record(sample))
console.log("detailOf 抽取:")
for (const d of detailOf(sample)) console.log(`  ${d._tag} → ${JSON.stringify(d).slice(0, 60)}`)

// 2. 读 detail agent 经 ClaudeDetail Connection 读全部。
const read = await Effect.runPromise(detailAgent.drive(0, undefined)) as ReadonlyArray<{ _tag: string }>
console.log("\n读 detail agent 拿到:", read.map((d) => d._tag).join(", "))

console.log("\n（真实调用需 ANTHROPIC_API_KEY；此处展示 detail Connection 结构）")
