import { Effect, Schema } from "effect"
import { query, type Options, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { Control, type Agent, type ConnectionImpl, type Driver } from "../../src/index.js"

/**
 * Claude Code driver —— IOECC 的具体 Driver（真实 SDK 实现）。
 *
 * Driver 就是 Agent（五维度）：ClaudeCode 是一个 Agent，声明：
 *   - connections  它连接的世界（provider / tools / skills）
 *   - controls     它声明的能力（RunClaude control，影响 provider/tools/skills）
 *   - run(prompt)  调真实 Claude Agent SDK（query 收集消息，取 result）
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

export interface ClaudeCodeOptions extends Omit<Options, "outputFormat" | "hooks"> {
  /** 注入为工具的 connection（use: "tool"）。 */
  readonly toolConnections?: ReadonlyArray<ClassifiedConnection>
  /** 注入为 skills 的 connection（use: "skill"）。 */
  readonly skillConnections?: ReadonlyArray<ClassifiedConnection>
  /** provider connection（use: "provider"）。 */
  readonly providerConnection?: ClassifiedConnection
}

/** 从 SDK 消息流提取最终 result 文本。 */
const extractResult = (messages: ReadonlyArray<SDKMessage>): Effect.Effect<string, Error> => {
  const result = messages.findLast((m) => m.type === "result")
  if (!result || result.subtype !== "success")
    return Effect.fail(new Error(result ? `Claude Code failed: ${result.subtype}` : "No result from Claude Code"))
  return Effect.succeed(result.result)
}

/**
 * 构造一个 Claude Code driver（Agent）。run 调真实 Claude Agent SDK。
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

  // 从 SDK options 拆分出我们要透传的字段（去掉 outputFormat/hooks）。
  const {
    toolConnections: _tc,
    skillConnections: _sc,
    providerConnection: _pc,
    ...sdkOptions
  } = options

  // 真实 SDK 调用：query 收集消息，取 result。
  const runOnce = (prompt: string): Effect.Effect<string, Error> =>
    Effect.tryPromise({
      try: async () => {
        const messages: SDKMessage[] = []
        for await (const message of query({
          prompt,
          options: sdkOptions as Options,
        })) messages.push(message)
        return messages
      },
      catch: (cause) => new Error(cause instanceof Error ? cause.message : String(cause)),
    }).pipe(Effect.flatMap(extractResult))

  // Claude Connection 实现：把 agent 的 "run" 意图路由到 SDK。
  const claudeImpl: ConnectionImpl = {
    handle: (op, args) => {
      if (op !== "run") return Effect.fail(new Error(`Claude can't ${op}`))
      return runOnce(String(args))
    },
  }

  // driver 的 controls：RunClaude 影响 Claude 世界。
  const runControl = new RunClaude(["Claude"])

  // Driver 主体（Agent 五维度）+ 附加能力。
  return {
    connections: ["Claude"],
    controls: [runControl],
    drivers: [],
    run: (prompt) => runOnce(prompt),
    classify,
    toImpl: () => claudeImpl,
  }
}
