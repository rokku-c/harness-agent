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
 * 错误用 effect-ts：Data.TaggedError（类型安全），SDK 迭代器转 Stream（错误通道自动）。
 */

/* ── 类型安全错误 ── */

export class ClaudeCodeError extends Data.TaggedError("ClaudeCodeError")<{
  readonly stage: "sdk" | "extract" | "fork"
  readonly cause: unknown
  readonly message?: string
}> {}

/** 收集 Claude SDK 消息（for-await 迭代 Query）。SDK Query 不是标准 AsyncIterable，
 *  Stream.fromAsyncIterable 会提前关闭 channel，故用 for-await + Effect 包边界。 */
export const collectClaude = (
  prompt: string,
  options: Options,
  onMessage?: (message: SDKMessage) => Effect.Effect<void>
): Effect.Effect<ReadonlyArray<SDKMessage>, ClaudeCodeError> =>
  Effect.tryPromise({
    try: async () => {
      const messages: SDKMessage[] = []
      for await (const message of query({ prompt, options })) {
        messages.push(message)
        if (onMessage) await Effect.runPromise(onMessage(message).pipe(Effect.ignore))
      }
      return messages
    },
    catch: (cause) => new ClaudeCodeError({ stage: "sdk", cause }),
  })

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
  /** 可选：运行时把每条 SDK 消息的 detail 记录到外部（如 ClaudeDetail Connection）。 */
  readonly onMessage?: (message: SDKMessage) => Effect.Effect<void>
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

  // 真实 SDK 调用：收集消息，取 result（for-await + Effect 包边界）。
  const runOnce = (prompt: string): Effect.Effect<string, ClaudeCodeError> =>
    collectClaude(prompt, sdkOptions as Options, options.onMessage).pipe(
      Effect.flatMap((messages) => extractResult(messages))
    )

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

/* ── configured：从 config.toml + .env 读 provider，构造 driver ── */

/** 解析 `${ENV_VAR}` 引用（如 `${LLM_API_KEY}`）。 */
const resolveEnv = (value: string, env: Readonly<Record<string, string | undefined>>): string =>
  value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_m, key: string) => env[key] ?? "")

/** 读 .env 文件（KEY=value 行），不覆盖已有 env。 */
const loadDotEnv = async (envFile: string, env: Record<string, string | undefined>): Promise<Record<string, string | undefined>> => {
  try {
    const text = await Bun.file(envFile).text()
    for (const line of text.split(/\r?\n/)) {
      const raw = line.trim().replace(/^export\s+/, "")
      if (!raw || raw.startsWith("#")) continue
      const eq = raw.indexOf("=")
      if (eq < 1) continue
      const key = raw.slice(0, eq).trim()
      let value = raw.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1)
      if (!(key in env)) env[key] = value
    }
  } catch { /* .env 不存在则忽略 */ }
  return env
}

export interface ClaudeConfiguredOptions {
  readonly path?: string
  /** .env 文件（默认 ".env"），提供 `${VAR}` 引用的值。 */
  readonly envFile?: string
  /** config.toml 里的 provider 名（默认 "claude"）。 */
  readonly provider?: string
  /** provider 分类（可选）。 */
  readonly providerConnection?: ClassifiedConnection
  readonly toolConnections?: ReadonlyArray<ClassifiedConnection>
  readonly skillConnections?: ReadonlyArray<ClassifiedConnection>
  /** 运行时 detail 记录。 */
  readonly onMessage?: (message: SDKMessage) => Effect.Effect<void>
}

/**
 * 从 config.toml + .env 读 provider（如 `[providers.claude]`），
 * 构造一个已配置好 apiKey/baseURL/model 的 Claude Code driver。
 */
export const configuredClaudeCode = (options: ClaudeConfiguredOptions = {}) =>
  Effect.gen(function* () {
    const path = options.path ?? "config.toml"
    const name = options.provider ?? "claude"
    // 先读 .env 填充，再合并 process.env（process.env 优先）。
    const env = yield* Effect.promise(() => loadDotEnv(options.envFile ?? ".env", { ...process.env }))

    // 读 config.toml（Bun.TOML），取 provider。
    const text = yield* Effect.tryPromise({
      try: async () => await Bun.file(path).text(),
      catch: (cause) => new ClaudeCodeError({ stage: "sdk", cause, message: `无法读取 ${path}` }),
    })
    const toml = Bun.TOML.parse(text) as {
      providers?: Record<string, { api?: string; model?: string; apiKey?: string; baseURL?: string }>
      insecureTls?: { enabled?: boolean }
    }
    const provider = toml.providers?.[name]
    if (!provider)
      return yield* Effect.fail(new ClaudeCodeError({ stage: "sdk", cause: `providers.${name} not in ${path}` }))
    const insecureTls = toml.insecureTls?.enabled ?? false

    const apiKey = provider.apiKey ? resolveEnv(provider.apiKey, env) : undefined
    const baseURL = provider.baseURL ? provider.baseURL.replace(/\/v1\/?$/, "") : undefined

    // 构造 driver：SDK options 用 env（ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL）+ model。
    return makeClaudeCodeDriver({
      model: provider.model,
      cwd: process.cwd(),
      settingSources: [],
      persistSession: false,
      permissionMode: "default",
      providerConnection: options.providerConnection ?? { name, use: "provider" },
      toolConnections: options.toolConnections,
      skillConnections: options.skillConnections,
      onMessage: options.onMessage,
      env: {
        ...env,
        CLAUDE_AGENT_SDK_CLIENT_APP: "effect-agent/0.0.0",
        ...(apiKey ? { ANTHROPIC_API_KEY: apiKey, ANTHROPIC_AUTH_TOKEN: apiKey } : {}),
        ...(baseURL ? { ANTHROPIC_BASE_URL: baseURL } : {}),
        ...(insecureTls ? { NODE_TLS_REJECT_UNAUTHORIZED: "0" } : {}),
      },
    })
  })
