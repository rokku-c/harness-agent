import { Data, Effect, Schema } from "effect"
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
 * 错误用 effect-ts：Data.TaggedError（类型安全），Effect.tryPromise 包 async 边界。
 */

/* ── 类型安全错误 ── */

export class ClaudeCodeError extends Data.TaggedError("ClaudeCodeError")<{
  readonly stage: "sdk" | "extract"
  readonly cause: unknown
  readonly message?: string
}> {}

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
    if (!claude) return Effect.fail(new ClaudeCodeError({ stage: "sdk", cause: "Claude connection not provided" }))
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
const extractResult = (messages: ReadonlyArray<SDKMessage>): Effect.Effect<string, ClaudeCodeError> => {
  const result = messages.findLast((m) => m.type === "result")
  if (!result) return Effect.fail(new ClaudeCodeError({ stage: "extract", cause: "No result message" }))
  if (result.subtype !== "success")
    return Effect.fail(new ClaudeCodeError({ stage: "extract", cause: result.subtype }))
  return Effect.succeed(result.result)
}

/**
 * 构造一个 Claude Code driver（Agent）。run 调真实 Claude Agent SDK。
 */
export const makeClaudeCodeDriver = (
  options: ClaudeCodeOptions = {}
): Driver & {
  readonly run: (prompt: string) => Effect.Effect<string, ClaudeCodeError>
  readonly classify: ReadonlyArray<ClassifiedConnection>
  readonly toImpl: () => ConnectionImpl
} => {
  // 连接的 connection 分类。
  const classify: ReadonlyArray<ClassifiedConnection> = [
    ...(options.providerConnection ? [options.providerConnection] : []),
    ...(options.toolConnections ?? []),
    ...(options.skillConnections ?? []),
  ]

  // 从 SDK options 拆分出我们要透传的字段（去掉分类字段）。
  const {
    toolConnections: _tc,
    skillConnections: _sc,
    providerConnection: _pc,
    ...sdkOptions
  } = options

  // 真实 SDK 调用：query 收集消息，取 result。async 边界用 tryPromise。
  const runOnce = (prompt: string): Effect.Effect<string, ClaudeCodeError> =>
    Effect.tryPromise({
      try: async () => {
        const messages: SDKMessage[] = []
        for await (const message of query({
          prompt,
          options: sdkOptions as Options,
        })) messages.push(message)
        return messages
      },
      catch: (cause) => new ClaudeCodeError({ stage: "sdk", cause }),
    }).pipe(Effect.flatMap(extractResult))

  // Claude Connection 实现：把 agent 的 "run" 意图路由到 SDK。
  const claudeImpl: ConnectionImpl = {
    handle: (op, args) => {
      if (op !== "run") return Effect.fail(new ClaudeCodeError({ stage: "sdk", cause: `Claude can't ${op}` }))
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
