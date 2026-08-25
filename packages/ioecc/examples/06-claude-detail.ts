import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"
import { configuredClaudeCode, makeClaudeDetail } from "../builtin/index.js"

/**
 * IOECC 示例 6 —— Claude Code 内部 detail 暴露为 Connection（真实 SDK）。
 *
 * driver 运行时把每条 SDK 消息的 detail（thinking/text/tool_use/result）写入共享 Ref；
 * 一个「读 detail」的 agent 声明影响 ClaudeDetail Connection，读取内部过程。
 * 观测 = 具体 driver 作为普通 Connection 注入。
 *
 * 运行：bun run ioecc:example claude-detail
 */

const program = Effect.gen(function* () {
  // ClaudeDetail Connection：收集 + 读取。
  const detail = makeClaudeDetail()

  // Claude Code driver：真实 SDK，每条消息 detail 写入 detail.ref。
  const claude = yield* configuredClaudeCode({
    path: "config.toml",
    provider: "claude",
    providerConnection: { name: "claude", use: "provider" },
    onMessage: (message) => detail.record(message),
  })

  // 读 detail 的 agent：经 ClaudeDetail Connection 读。
  class ReadDetail extends Control<void, unknown> {
    readonly input = Schema.Void
    readonly output = Schema.Unknown
    constructor() { super("ReadDetail", ["ClaudeDetail"]) }
    run(_i: void, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<unknown, Error> {
      return impls.get("ClaudeDetail")!.handle("list", undefined)
    }
  }
  const detailAgent = EffectAgent.gen({
    connections: ["ClaudeDetail"],
    controls: [new ReadDetail()],
  }, [], new Map<string, ConnectionImpl>([
    ["ClaudeDetail", detail.impl],
  ]))

  // 跑真实 Claude Code（driver 的 RunClaude 经 Claude Connection），同时记录 detail。
  const answer = yield* claude.run("用一句话解释什么是函数式编程").pipe(Effect.either)

  // 跑完后读 detail。
  const details = yield* detailAgent.drive(0, undefined)

  return { answer, details }
})

console.log("=== Claude Code detail Connection（真实 SDK） ===")
const { answer, details } = await Effect.runPromise(program)
if (answer._tag === "Right") {
  console.log("Claude 回答:", String(answer.right).slice(0, 80))
} else {
  console.log("Claude 运行失败:", String(answer.left).slice(0, 100))
}
const ds = details as ReadonlyArray<{ _tag: string }>
console.log("\n读 detail agent 拿到", ds.length, "条:", ds.map((d) => d._tag).join(", "))
