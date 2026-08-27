import { Effect, Runtime, Schema } from "effect"
import {
  createSdkMcpServer,
  query,
  tool as sdkTool,
  type Options,
  type SDKMessage
} from "@anthropic-ai/claude-agent-sdk"
import { cp, mkdir, mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import * as z from "zod"
import { AgentFailure, decode, type Driver, materialize, report, requireUntil, schemaJson, type RunRequest } from "../core.js"
import { loadToml, ProviderConfigError, type LoadProvidersOptions } from "../providers.js"

export interface ClaudeCodeOptions extends Omit<Options, "outputFormat" | "hooks"> {
  readonly query?: typeof query
  /** Claude Agent SDK native hooks. These are not effect-agent HarnessHooks. */
  readonly claudeCodeHooks?: Options["hooks"]
  /** Isolated CLAUDE_CONFIG_DIR. A random temporary directory is used when omitted. */
  readonly claudeHome?: string
  /** Skill directories or SKILL.md files copied into the isolated Claude home. */
  readonly skillPaths?: ReadonlyArray<string>
  /**
   * Forward `NODE_TLS_REJECT_UNAUTHORIZED=0` to the Claude Code child process to
   * disable certificate verification. Only use when an upstream gateway serves a
   * broken or expired certificate you cannot replace; this bypasses TLS entirely
   * and is a security risk. Off by default.
   */
  readonly insecureTls?: boolean
}

export interface ClaudeCodeTomlOptions extends LoadProvidersOptions {
  readonly name?: string
  /** Inherit model, API key and base URL from [providers.<name>]. */
  readonly provider?: string
  /** Global default for `insecureTls`, applied when an agent does not set it explicitly. */
  readonly insecureTls?: boolean | InsecureTlsConfig
  readonly overrides?: ClaudeCodeOptions
}

interface ClaudeCodeTomlConfig extends Omit<ClaudeCodeOptions, "query" | "env"> {
  readonly provider?: string
  readonly apiKey?: string
  readonly authToken?: string
  readonly baseURL?: string
  readonly env?: Record<string, string>
}

/** Top-level `[insecureTls]` table. Defaults every composed agent's TLS override unless an agent sets it explicitly. */
export interface InsecureTlsConfig {
  readonly enabled?: boolean
}

const safeToolName = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, "_")

const zodFromJson = (schema: any): z.ZodType => {
  if (schema?.enum && Array.isArray(schema.enum)) {
    const values = schema.enum
    if (values.length === 1) return z.literal(values[0] as any)
    if (values.every((value: unknown) => typeof value === "string"))
      return z.enum(values as [string, ...string[]])
    return z.union(values.map((value: unknown) => z.literal(value as any)) as [z.ZodType, z.ZodType, ...z.ZodType[]])
  }
  switch (schema?.type) {
    case "string": return z.string()
    case "integer": return z.number().int()
    case "number": return z.number()
    case "boolean": return z.boolean()
    case "array": return z.array(zodFromJson(schema.items))
    case "object": {
      const required = new Set<string>(schema.required ?? [])
      return z.object(Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, value]) => {
        const field = zodFromJson(value)
        return [key, required.has(key) ? field : field.optional()]
      }))).loose()
    }
    default: return z.unknown()
  }
}

const mcpTools = (request: RunRequest<any, any>, runtime: Runtime.Runtime<any>) =>
  request.access.flatMap(({ binding, write }) => (binding.ops ?? [])
    .filter((op) => op.access === "read" || write)
    .map((op) => {
      const name = safeToolName(op.name)
      const json = schemaJson(op.input) as any
      const root = zodFromJson(json)
      const shape = root instanceof z.ZodObject ? root.shape : { input: root }
      return {
        opName: op.name,
        name,
        allowedName: `mcp__effect_agent__${name}`,
        definition: sdkTool(name, op.description, shape, async (input) => {
          const decoded = await Runtime.runPromise(runtime)(Schema.decodeUnknown(op.input)(input))
          const output = await Runtime.runPromise(runtime)(op.execute(decoded))
          return { content: [{ type: "text" as const, text: JSON.stringify(output) }] }
        })
      }
    }))

const acquireClaudeHome = (configured?: string) => configured
  ? Effect.succeed({ path: resolve(configured), temporary: false })
  : Effect.acquireRelease(
      Effect.tryPromise({
        try: () => mkdtemp(join(tmpdir(), "effect-agent-claude-")),
        catch: (cause) => new AgentFailure({ agent: "claude-code", cause, message: "Unable to create temporary Claude home" })
      }).pipe(Effect.map((path) => ({ path, temporary: true }))),
      ({ path, temporary }) => temporary
        ? Effect.promise(() => rm(path, { recursive: true, force: true })).pipe(Effect.ignore)
        : Effect.void
    )

const injectSkills = (home: string, paths: ReadonlyArray<string>) => Effect.tryPromise({
  try: async () => {
    if (paths.length === 0) return
    const root = join(home, "skills")
    await mkdir(root, { recursive: true })
    for (const sourcePath of paths) {
      const source = resolve(sourcePath)
      const info = await stat(source)
      const directory = info.isDirectory() ? source : dirname(source)
      const name = basename(directory)
      await cp(directory, join(root, name), { recursive: true, force: false, errorOnExist: true })
    }
  },
  catch: (cause) => new AgentFailure({ agent: "claude-code", cause, message: `Unable to inject Claude skills: ${String(cause)}` })
})

const fromConfig = (config: ClaudeCodeTomlConfig, overrides: ClaudeCodeOptions = {}): ClaudeCodeOptions => {
  const { provider: _provider, apiKey, authToken, baseURL, env, ...sdk } = config
  const configuredEnv = apiKey || authToken || baseURL || env ? {
    ...process.env,
    ...env,
    ...(apiKey ? { ANTHROPIC_API_KEY: apiKey } : {}),
    ...(authToken || apiKey ? { ANTHROPIC_AUTH_TOKEN: authToken ?? apiKey } : {}),
    ...(baseURL ? { ANTHROPIC_BASE_URL: baseURL.replace(/\/v1\/?$/, "") } : {}),
    CLAUDE_AGENT_SDK_CLIENT_APP: "effect-agent/0.0.0"
  } : undefined
  return { ...sdk, ...(configuredEnv ? { env: configuredEnv } : {}), ...overrides }
}

export const ClaudeCode = {
  make: (options: ClaudeCodeOptions = {}): Driver => {
    const driver: Driver = {
      id: "claude-code",
      capabilities: {
        provider: { _tag: "Fixed", api: "anthropic.agent-sdk" }, granularity: "event", thinking: true,
        cancel: true, pause: false, resume: true, fork: "node",
        tools: "mcp", toolCalls: "observe", structuredOutput: "native", sandbox: "delegated"
      },
      run: <A, R>(request: RunRequest<A, R>) => Effect.gen(function*() {
        yield* requireUntil(driver.id, driver.capabilities, request.until)
        request = yield* materialize(request)
        const runtime = yield* Effect.runtime<any>()
        const home = yield* acquireClaudeHome(options.claudeHome)
        yield* injectSkills(home.path, options.skillPaths ?? [])
        const injected = mcpTools(request, runtime)
        const runQuery = options.query ?? query
        const {
          query: _query,
          claudeHome: _home,
          skillPaths: _skillPaths,
          claudeCodeHooks,
          insecureTls,
          ...sdkOptions
        } = options
        const outputFormat = request.until._tag === "Schema"
          ? { type: "json_schema" as const, schema: schemaJson(request.until.schema) as unknown as Record<string, unknown> }
          : undefined
        const effectiveTools = sdkOptions.tools ?? []
        const effectiveSkills = sdkOptions.skills ?? ((options.skillPaths?.length ?? 0) > 0 ? "all" : undefined)
        const effectiveAllowedTools = [
          ...(sdkOptions.allowedTools ?? []),
          ...injected.map(({ allowedName }) => allowedName)
        ]
        const effectiveMcpServers = injected.length > 0 ? {
          ...sdkOptions.mcpServers,
          effect_agent: createSdkMcpServer({
            name: "effect_agent",
            version: "0.0.0",
            tools: injected.map(({ definition }) => definition)
          })
        } : sdkOptions.mcpServers
        const effectiveEnv: Record<string, string | undefined> = {
          ...process.env,
          ...sdkOptions.env,
          CLAUDE_CONFIG_DIR: home.path,
          CLAUDE_AGENT_SDK_CLIENT_APP: "effect-agent/0.0.0",
          ...(insecureTls ? { NODE_TLS_REJECT_UNAUTHORIZED: "0" } : {})
        }
        yield* report(request, {
          _tag: "DriverPrepared",
          agent: driver.id,
          runtime: "claude-agent-sdk",
          details: {
            cwd: sdkOptions.cwd ?? process.cwd(),
            claudeHome: home.path,
            temporaryClaudeHome: home.temporary,
            model: sdkOptions.model ?? "<claude-default>",
            fallbackModel: sdkOptions.fallbackModel,
            permissionMode: sdkOptions.permissionMode ?? "default",
            builtinTools: effectiveTools,
            allowedTools: effectiveAllowedTools,
            disallowedTools: sdkOptions.disallowedTools ?? [],
            injectedOps: injected.map(({ opName, allowedName }) => ({ op: opName, claudeTool: allowedName })),
            mcpServers: Object.keys(effectiveMcpServers ?? {}),
            skillPaths: options.skillPaths ?? [],
            skills: effectiveSkills ?? [],
            settingSources: sdkOptions.settingSources ?? "<claude-default>",
            persistSession: sdkOptions.persistSession ?? true,
            maxTurns: sdkOptions.maxTurns,
            maxBudgetUsd: sdkOptions.maxBudgetUsd,
            thinking: sdkOptions.thinking,
            effort: sdkOptions.effort,
            sandbox: sdkOptions.sandbox ?? { enabled: false },
            strictMcpConfig: sdkOptions.strictMcpConfig ?? false,
            insecureTls: insecureTls ?? false,
            nativeHookEvents: Object.keys(claudeCodeHooks ?? {}),
            output: request.until._tag,
            structuredOutput: outputFormat?.type,
            executable: sdkOptions.pathToClaudeCodeExecutable ?? sdkOptions.executable ?? "<sdk-default>",
            authentication: {
              apiKeyConfigured: Boolean(effectiveEnv.ANTHROPIC_API_KEY),
              authTokenConfigured: Boolean(effectiveEnv.ANTHROPIC_AUTH_TOKEN),
              baseURL: effectiveEnv.ANTHROPIC_BASE_URL ?? "<anthropic-default>"
            }
          }
        })
        const messages = yield* Effect.tryPromise({
          try: async () => {
            const all: SDKMessage[] = []
            for await (const message of runQuery({
              prompt: request.context.render(),
              options: {
                ...sdkOptions,
                hooks: claudeCodeHooks,
                cwd: sdkOptions.cwd ?? process.cwd(),
                tools: effectiveTools,
                skills: effectiveSkills,
                env: effectiveEnv,
                mcpServers: effectiveMcpServers,
                allowedTools: effectiveAllowedTools,
                outputFormat
              }
            })) all.push(message)
            return all
          },
          catch: (cause) => new AgentFailure({
            agent: driver.id,
            cause,
            message: cause instanceof Error ? cause.message : String(cause)
          })
        })
        const result = messages.findLast((message) => message.type === "result")
        if (!result || result.subtype !== "success")
          return yield* new AgentFailure({ agent: driver.id, cause: result ?? "No result" })
        if (request.until._tag === "Schema") return yield* decode(request.until.schema, result.structured_output)
        if (request.until._tag === "Stop" || request.until._tag === "Text") return result.result as A
        const assistant = messages.findLast((message) => message.type === "assistant")
        const blocks = assistant?.message.content ?? []
        if (request.until._tag === "Thinking") {
          const thinking = blocks.find((block) => block.type === "thinking")
          return (thinking && "thinking" in thinking ? thinking.thinking : "") as A
        }
        // P1: enable once the unified event/pause protocol lands. Until then
        // requireUntil rejects Until.toolCall (toolCalls: "observe"), so this
        // branch is unreachable through negotiation and must not be advertised.
        const call = blocks.find((block) => block.type === "tool_use")
        if (!call || !("id" in call) || !("name" in call))
          return yield* new AgentFailure({ agent: driver.id, cause: "No tool call produced" })
        return { _tag: "ToolCall", id: call.id, name: call.name, input: call.input } as A
      }).pipe(Effect.scoped)
    }
    return driver
  },

  configured: (options: ClaudeCodeTomlOptions = {}) => loadToml({
    ...options,
    path: options.path ?? "config.toml"
  }).pipe(Effect.flatMap((document) => Effect.try({
    try: () => {
      const name = options.name ?? "claudeCode"
      const root = document as {
        providers?: Record<string, { api?: string; model?: string; apiKey?: string; baseURL?: string }>
        composedAgents?: Record<string, ClaudeCodeTomlConfig>
        insecureTls?: InsecureTlsConfig
      }
      const config = root.composedAgents?.[name] ?? {}
      if (!config || typeof config !== "object")
        throw new ProviderConfigError({ path: options.path ?? "config.toml", message: `composedAgents.${name} must be a table` })
      const programGlobal = typeof options.insecureTls === "object"
        ? options.insecureTls?.enabled
        : options.insecureTls
      // Programmatic global wins over the top-level [insecureTls] table in the document.
      const globalTls = programGlobal ?? root.insecureTls?.enabled
      const providerName = options.provider ?? config.provider
      const provider = providerName ? root.providers?.[providerName] : undefined
      if (providerName && !provider)
        throw new ProviderConfigError({ path: options.path ?? "config.toml", message: `providers.${providerName} does not exist` })
      if (provider?.api && provider.api !== "anthropic.messages")
        throw new ProviderConfigError({ path: options.path ?? "config.toml", message: `Claude Code requires an anthropic.messages-compatible provider, got ${provider.api}` })
      return ClaudeCode.make(fromConfig({
        ...(provider ? {
          model: provider.model,
          apiKey: provider.apiKey,
          baseURL: provider.baseURL
        } : {}),
        ...config,
        ...(config.insecureTls === undefined && globalTls !== undefined ? { insecureTls: globalTls } : {})
      }, options.overrides))
    },
    catch: (cause) => cause instanceof ProviderConfigError
      ? cause
      : new ProviderConfigError({ path: options.path ?? "config.toml", message: String(cause) })
  })))
}
