import { Effect, Schema } from "effect"
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { Control, type Agent, type ConnectionImpl, type Driver } from "../../src/index.js"

/**
 * Claude Code driver —— IOECC 的具体 Driver。
 *
 * Driver 就是 Agent（五维度）：ClaudeCode 是一个 Agent，声明：
 *   - connections  它连接的世界（provider / tools / skills）
 *   - controls     它声明的能力（RunClaude control，影响 provider/tools/skills）
 *   - run(prompt)  调真实 Claude Agent SDK（具体 driver 能力，非核心字段）
 *
 * connection 分类（哪个作为 provider 配置 / 注入为工具 / 注入为 skills）
 * 由 connection 自己的 use 标记声明，driver 只声明它连接了哪些世界。
 */

/* ── Connection 分类：connection 自己带 use 标记 ── */

export type ConnectionUse = "provider" | "tool" | "skill"

export interface ClassifiedConnection {
  readonly name: string
  readonly use: ConnectionUse
}

/* ── RunClaude control：经 claude 相关 connection 交互 ── */

export class RunClaude extends Control<string, string> {
  readonly input = Schema.String
  readonly output = Schema.String
  constructor(affects: ReadonlyArray<string> = ["Claude"]) {
    super("RunClaude", affects)
  }
  run(i: string, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<string, Error> {
    const claude = impls.get("Claude")
    if (!claude) return Effect.fail(new Error("Claude connection not provided"))
    return claude.handle("run", i) as Effect.Effect<string, Error>
  }
}

/* ── ClaudeCode driver ── */

export interface ClaudeCodeOptions {
  /** model 等 provider 配置（真实 SDK 用）。 */
  readonly model?: string
  readonly maxTurns?: number
  readonly permissionMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions"
  readonly cwd?: string
  /** 注入为工具的 connection（use: "tool"）。 */
  readonly toolConnections?: ReadonlyArray<ClassifiedConnection>
  /** 注入为 skills 的 connection（use: "skill"）。 */
  readonly skillConnections?: ReadonlyArray<ClassifiedConnection>
  /** provider connection（use: "provider"）。 */
  readonly providerConnection?: ClassifiedConnection
}

/**
 * 构造一个 Claude Code driver（Agent）。
 * 它声明连接的 connection + 一个 RunClaude control；run 调真实 SDK。
 * 这里保留「声明如何设置」——不真的起 Claude Code，除非提供真实 provider。
 */
export const makeClaudeCodeDriver = (
  options: ClaudeCodeOptions = {}
): Driver & {
  readonly run: (prompt: string) => Effect.Effect<string, Error>
  readonly classify: ReadonlyArray<ClassifiedConnection>
  readonly toImpl: () => ConnectionImpl
} => {
  // 连接的 connection 分类。
  const classify: ReadonlyArray<ClassifiedConnection> = [
    ...(options.providerConnection ? [options.providerConnection] : []),
    ...(options.toolConnections ?? []),
    ...(options.skillConnections ?? []),
  ]

  // Claude Connection 实现：把 agent 的 "run" 意图路由到 SDK。
  const claudeImpl: ConnectionImpl = {
    handle: (op, args) => {
      if (op !== "run") return Effect.fail(new Error(`Claude can't ${op}`))
      // 真实实现会调 SDK；这里占位（无真实 provider 时）。
      return Effect.succeed(`[claude:${options.model ?? "default"}] ${String(args)}`)
    },
  }

  // driver 的 controls：RunClaude 影响 Claude 世界。
  const runControl = new RunClaude(["Claude"])

  // Driver 主体（Agent 五维度）+ 附加能力。
  return {
    connections: ["Claude"],
    controls: [runControl],
    drivers: [],
    run: (prompt) => {
      // 真实实现：const messages: SDKMessage[] = []
      // for await (const m of query({ prompt, options: { model: options.model } })) ...
      // 这里占位（保留 SDK 导入以备真实实现）。
      return claudeImpl.handle("run", prompt) as Effect.Effect<string, Error>
    },
    classify,
    toImpl: () => claudeImpl,
  }
}
