import { Effect, Schema } from "effect"
import { Connection, ConnectionImpl, Control, Driver, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 5 —— Claude Code adapter（具体 driver）。
 *
 * 声明一个 Claude Code driver：它是一个 Agent（五维度），附加自己的方法。
 * 关键：connection 如何映射到 Claude Code 的三类注入 ——
 *   provider（模型/API 配置）、tools（MCP 工具）、skills（技能目录）。
 * 这只是「声明如何设置」，不真的起 Claude Code。
 *
 * 运行：bun packages/ioecc/examples/05-claude-adapter.ts
 */

/* ── E：agent 经 claude driver 声明交互 ── */
const run = { _tag: "ClaudeRun", connection: "Claude" } as const

/* ── Connection 声明：三类注入映射 ── */
const providerConn: Connection = { name: "provider" }       // provider 配置
const toolsConn: Connection = { name: "tools" }             // 注入为工具
const skillsConn: Connection = { name: "skills" }           // 注入为 skills

/**
 * Claude Code driver —— 一个 Agent，声明「哪些 connection 是 provider / tools / skills」。
 * 这些映射是具体 driver 自己的声明（非核心强制字段）。
 */
const claudeCodeDriver = {
  // 五维度（Agent 形状）
  input: Schema.String,
  output: Schema.String,
  effects: [run],
  connections: [providerConn, toolsConn, skillsConn],
  controls: [],
  drivers: [],

  // 具体 driver 的声明：connection 如何注入到 Claude Code
  provider: (conn: Connection) => ({ model: "claude-opus", baseUrl: `https://api.${conn.name}.com` }),
  tools: (conn: Connection) => ({ mcpServer: conn.name, tools: ["readFile", "writeFile"] }),
  skills: (conn: Connection) => ({ skillDir: `./skills/${conn.name}` }),

  // 具体 driver 能力：跑 Claude Code
  run: (prompt: string) => Effect.succeed(`[claude] ${prompt}`),
}

/* ── 主 agent：经 claude driver 跑 ── */
const program = EffectAgent.gen({
  input: Schema.String,
  output: Schema.String,
  effects: [run],
  connections: [{ name: "Claude" }],
  controls: [new (class extends Control<string, string> {
    constructor() { super("RunClaude") }
    run(_i: string, _o: string, _e: ReadonlyArray<any>, _cn: ReadonlyArray<any>, _ct: ReadonlyArray<any>, d: Driver): Effect.Effect<string, Error> {
      const concrete = d as unknown as { run: (i: string) => Effect.Effect<string, Error> }
      return concrete.run(_i)
    }
  })()],
}, [claudeCodeDriver])

console.log("=== Claude Code adapter ===")
console.log("driver 是 Agent（五维度），connections:", claudeCodeDriver.connections.map((c) => c.name).join(", "))
console.log("\n=== 三类注入映射声明 ===")
console.log("provider 配置:", claudeCodeDriver.provider(providerConn))
console.log("注入为工具:", claudeCodeDriver.tools(toolsConn))
console.log("注入为 skills:", claudeCodeDriver.skills(skillsConn))

const out = await Effect.runPromise(program.drive(0, "review this code"))
console.log("\n=== 经 Claude driver 运行 ===")
console.log(out)
