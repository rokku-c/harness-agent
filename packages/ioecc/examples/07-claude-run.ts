import { Effect } from "effect"
import { configuredClaudeCode, RunClaude } from "../builtin/index.js"
import { ConnectionImpl, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 7 —— 用 Claude Code driver（真实 SDK）跑。
 *
 * 从 config.toml + .env 读 provider（[providers.claude]），构造已配置的 driver。
 * agent 的 RunClaude control 经 Claude Connection 调真实 SDK。
 *
 * 运行：bun packages/ioecc/examples/07-claude-run.ts
 */

const program = Effect.gen(function* () {
  // 从 config.toml 读 [providers.claude]，构造已配置的 driver。
  const claude = yield* configuredClaudeCode({
    path: "config.toml",
    provider: "claude",
    providerConnection: { name: "claude", use: "provider" },
    toolConnections: [{ name: "fs", use: "tool" }],
    skillConnections: [{ name: "review", use: "skill" }],
  })

  // agent：经 claude driver 的 RunClaude control 交互。
  const agent = EffectAgent.gen({
    connections: ["Claude"],
    controls: [new RunClaude()],
  }, [claude], new Map<string, ConnectionImpl>([
    ["Claude", claude.toImpl()],
  ]))

  console.log("=== Claude Code driver（config.toml 配置） ===")
  console.log("connection 分类:", claude.classify.map((c) => `${c.name}:${c.use}`).join(", "))

  // 真实 SDK 调用：跑 Claude Code。
  return yield* agent.drive(0, "用三句话解释 Effect 的依赖注入。")
})

const result = await Effect.runPromise(program.pipe(Effect.either))
if (result._tag === "Right") {
  console.log("\n=== 运行结果 ===")
  console.log(result.right)
} else {
  console.log("\n=== 失败 ===")
  console.log(String(result.left).slice(0, 200))
  console.log("（检查 config.toml 的 provider + .env 的 LLM_API_KEY）")
}
