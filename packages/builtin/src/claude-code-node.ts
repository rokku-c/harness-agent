import {
  deleteSession,
  forkSession,
  getSessionInfo,
  getSessionMessages,
  listSessions,
  query,
  renameSession,
  tagSession,
  type Options,
  type PermissionMode,
  type Query,
  type SDKMessage,
  type SDKUserMessage
} from "@anthropic-ai/claude-agent-sdk"
import { Effect, PubSub, Stream } from "effect"
import type {
  AdapterRef,
  CapabilitySpec,
  ConnectionAdapter,
  ConnectionSession,
  ConnectionSpec,
  JsonSchema
} from "@effect-agent/core"

export const ClaudeCodeCapabilities = {
  run: "claude-code/run",
  interrupt: "claude-code/interrupt",
  setPermissionMode: "claude-code/set-permission-mode",
  setMcpPermissionMode: "claude-code/set-mcp-permission-mode",
  setModel: "claude-code/set-model",
  setThinking: "claude-code/set-thinking",
  applySettings: "claude-code/apply-settings",
  initialize: "claude-code/initialize",
  reinitialize: "claude-code/reinitialize",
  commands: "claude-code/commands",
  models: "claude-code/models",
  agents: "claude-code/agents",
  mcpStatus: "claude-code/mcp-status",
  contextUsage: "claude-code/context-usage",
  readFile: "claude-code/read-file",
  reloadPlugins: "claude-code/reload-plugins",
  reloadSkills: "claude-code/reload-skills",
  account: "claude-code/account",
  rewindFiles: "claude-code/rewind-files",
  seedReadState: "claude-code/seed-read-state",
  backgroundTasks: "claude-code/background-tasks",
  sessionsList: "claude-code/sessions/list",
  sessionInfo: "claude-code/sessions/info",
  sessionMessages: "claude-code/sessions/messages",
  sessionRename: "claude-code/sessions/rename",
  sessionTag: "claude-code/sessions/tag",
  sessionFork: "claude-code/sessions/fork",
  sessionDelete: "claude-code/sessions/delete"
} as const

export type ClaudeCodeCapability = typeof ClaudeCodeCapabilities[keyof typeof ClaudeCodeCapabilities]

export const ClaudeCodeCapabilityGroups = {
  run: [ClaudeCodeCapabilities.run],
  control: [
    ClaudeCodeCapabilities.interrupt,
    ClaudeCodeCapabilities.setPermissionMode,
    ClaudeCodeCapabilities.setMcpPermissionMode,
    ClaudeCodeCapabilities.setModel,
    ClaudeCodeCapabilities.setThinking,
    ClaudeCodeCapabilities.applySettings,
    ClaudeCodeCapabilities.rewindFiles,
    ClaudeCodeCapabilities.seedReadState,
    ClaudeCodeCapabilities.backgroundTasks
  ],
  inspect: [
    ClaudeCodeCapabilities.initialize,
    ClaudeCodeCapabilities.reinitialize,
    ClaudeCodeCapabilities.commands,
    ClaudeCodeCapabilities.models,
    ClaudeCodeCapabilities.agents,
    ClaudeCodeCapabilities.mcpStatus,
    ClaudeCodeCapabilities.contextUsage,
    ClaudeCodeCapabilities.readFile,
    ClaudeCodeCapabilities.reloadPlugins,
    ClaudeCodeCapabilities.reloadSkills,
    ClaudeCodeCapabilities.account
  ],
  sessions: [
    ClaudeCodeCapabilities.sessionsList,
    ClaudeCodeCapabilities.sessionInfo,
    ClaudeCodeCapabilities.sessionMessages,
    ClaudeCodeCapabilities.sessionRename,
    ClaudeCodeCapabilities.sessionTag,
    ClaudeCodeCapabilities.sessionFork,
    ClaudeCodeCapabilities.sessionDelete
  ]
} as const satisfies Readonly<Record<string, ReadonlyArray<ClaudeCodeCapability>>>

const allCapabilities = new Set<string>(Object.values(ClaudeCodeCapabilities))
const objectSchema: JsonSchema = { type: "object", additionalProperties: true }
const stringSchema: JsonSchema = { type: "string" }
const object = (properties: Readonly<Record<string, JsonSchema>>, required: ReadonlyArray<string> = []): JsonSchema => ({
  type: "object",
  properties,
  ...(required.length > 0 ? { required } : {}),
  additionalProperties: true
})

const modes: Readonly<Partial<Record<ClaudeCodeCapability, "read" | "write" | "control">>> = {
  [ClaudeCodeCapabilities.run]: "control",
  [ClaudeCodeCapabilities.interrupt]: "control",
  [ClaudeCodeCapabilities.setPermissionMode]: "control",
  [ClaudeCodeCapabilities.setMcpPermissionMode]: "control",
  [ClaudeCodeCapabilities.setModel]: "control",
  [ClaudeCodeCapabilities.setThinking]: "control",
  [ClaudeCodeCapabilities.applySettings]: "control",
  [ClaudeCodeCapabilities.reinitialize]: "control",
  [ClaudeCodeCapabilities.reloadPlugins]: "control",
  [ClaudeCodeCapabilities.reloadSkills]: "control",
  [ClaudeCodeCapabilities.rewindFiles]: "write",
  [ClaudeCodeCapabilities.seedReadState]: "control",
  [ClaudeCodeCapabilities.backgroundTasks]: "control",
  [ClaudeCodeCapabilities.sessionRename]: "write",
  [ClaudeCodeCapabilities.sessionTag]: "write",
  [ClaudeCodeCapabilities.sessionFork]: "write",
  [ClaudeCodeCapabilities.sessionDelete]: "write"
}

const activeInput = object({ runId: stringSchema }, ["runId"])
const sessionInput = object({ sessionId: stringSchema, options: objectSchema }, ["sessionId"])
const inputSchemas: Readonly<Partial<Record<ClaudeCodeCapability, JsonSchema>>> = {
  [ClaudeCodeCapabilities.run]: object({ prompt: stringSchema, runId: stringSchema, options: objectSchema }, ["prompt"]),
  [ClaudeCodeCapabilities.setPermissionMode]: object({ runId: stringSchema, mode: stringSchema }, ["runId", "mode"]),
  [ClaudeCodeCapabilities.setMcpPermissionMode]: object({ runId: stringSchema, server: stringSchema, mode: {} }, ["runId", "server", "mode"]),
  [ClaudeCodeCapabilities.setModel]: object({ runId: stringSchema, model: stringSchema }, ["runId"]),
  [ClaudeCodeCapabilities.setThinking]: object({ runId: stringSchema, maxTokens: {}, display: {} }, ["runId", "maxTokens"]),
  [ClaudeCodeCapabilities.applySettings]: object({ runId: stringSchema, settings: objectSchema }, ["runId", "settings"]),
  [ClaudeCodeCapabilities.readFile]: object({ runId: stringSchema, path: stringSchema, options: objectSchema }, ["runId", "path"]),
  [ClaudeCodeCapabilities.rewindFiles]: object({ runId: stringSchema, userMessageId: stringSchema, options: objectSchema }, ["runId", "userMessageId"]),
  [ClaudeCodeCapabilities.seedReadState]: object({ runId: stringSchema, path: stringSchema, mtime: { type: "number" } }, ["runId", "path", "mtime"]),
  [ClaudeCodeCapabilities.sessionsList]: object({ options: objectSchema }),
  [ClaudeCodeCapabilities.sessionRename]: object({ sessionId: stringSchema, title: stringSchema, options: objectSchema }, ["sessionId", "title"]),
  [ClaudeCodeCapabilities.sessionTag]: object({ sessionId: stringSchema, tag: {}, options: objectSchema }, ["sessionId", "tag"]),
  [ClaudeCodeCapabilities.sessionFork]: sessionInput,
  [ClaudeCodeCapabilities.sessionDelete]: sessionInput
}

const activeCapabilities = new Set<ClaudeCodeCapability>([
  ...ClaudeCodeCapabilityGroups.control,
  ...ClaudeCodeCapabilityGroups.inspect
])
const sessionCapabilities = new Set<ClaudeCodeCapability>(ClaudeCodeCapabilityGroups.sessions)

const inputSchemaFor = (name: ClaudeCodeCapability) => inputSchemas[name]
  ?? (activeCapabilities.has(name) ? activeInput : sessionCapabilities.has(name) ? sessionInput : objectSchema)

const outputSchemaFor = (name: ClaudeCodeCapability): JsonSchema => name === ClaudeCodeCapabilities.run
  ? object({ runId: stringSchema, sessionId: stringSchema, result: objectSchema, messages: { type: "array", items: objectSchema } }, ["runId", "messages"])
  : objectSchema

const capabilitySpecs: Readonly<Record<ClaudeCodeCapability, CapabilitySpec>> = Object.fromEntries(
  Object.values(ClaudeCodeCapabilities).map((name) => [name, {
    name,
    input: inputSchemaFor(name),
    output: outputSchemaFor(name),
    mode: modes[name] ?? "read"
  }])
) as unknown as Readonly<Record<ClaudeCodeCapability, CapabilitySpec>>

const record = (input: unknown): Record<string, unknown> =>
  input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}

const requiredString = (input: Record<string, unknown>, name: string) => {
  const value = input[name]
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a non-empty string`)
  return value
}

const optionalRecord = (value: unknown): Record<string, unknown> => record(value)

const promiseEffect = <A>(run: () => Promise<A>): Effect.Effect<A, Error> => Effect.tryPromise({
  try: run,
  catch: (cause) => cause instanceof Error ? cause : new Error(String(cause))
})

const onePrompt = async function* (prompt: string): AsyncGenerator<SDKUserMessage> {
  yield {
    type: "user",
    message: { role: "user", content: prompt },
    parent_tool_use_id: null
  }
}

interface ClaudeCodeSdk {
  readonly query: typeof query
  readonly listSessions: typeof listSessions
  readonly getSessionInfo: typeof getSessionInfo
  readonly getSessionMessages: typeof getSessionMessages
  readonly renameSession: typeof renameSession
  readonly tagSession: typeof tagSession
  readonly forkSession: typeof forkSession
  readonly deleteSession: typeof deleteSession
}

const officialSdk: ClaudeCodeSdk = {
  query,
  listSessions,
  getSessionInfo,
  getSessionMessages,
  renameSession,
  tagSession,
  forkSession,
  deleteSession
}

export interface ClaudeCodeAdapterOptions {
  readonly kind?: string
  readonly options?: Options
  /** Test/vendor seam; omitted in normal use. */
  readonly sdk?: Partial<ClaudeCodeSdk>
}

/** Node-only Claude Agent SDK interpreter for declarative connections. */
export const claudeCodeAdapter = (options: ClaudeCodeAdapterOptions = {}): ConnectionAdapter => {
  const kind = options.kind ?? "builtin.claude-code"
  const sdk = { ...officialSdk, ...options.sdk }
  return {
    kind,
    capabilities: allCapabilities,
    connect: (spec, ref) => Effect.gen(function* () {
      const eventBus = yield* PubSub.unbounded<{
        readonly connectionId: string
        readonly adapter: string
        readonly kind: string
        readonly payload?: unknown
      }>()
      const active = new Map<string, Query>()
      const refValue = record(ref.config)
      const refOptions = ("options" in refValue ? optionalRecord(refValue.options) : refValue) as Partial<Options>

      const activeQuery = (input: Record<string, unknown>) => Effect.try({
        try: () => {
          const runId = requiredString(input, "runId")
          const running = active.get(runId)
          if (!running) throw new Error(`Claude Code run is not active: ${runId}`)
          return running
        },
        catch: (cause) => cause instanceof Error ? cause : new Error(String(cause))
      })

      const withActive = <A>(input: Record<string, unknown>, f: (running: Query) => Promise<A>) =>
        activeQuery(input).pipe(Effect.flatMap((running) => promiseEffect(() => f(running))))

      const run = (input: Record<string, unknown>) => Effect.tryPromise({
        try: async () => {
          const prompt = requiredString(input, "prompt")
          const runId = typeof input.runId === "string" && input.runId.length > 0
            ? input.runId
            : globalThis.crypto.randomUUID()
          if (active.has(runId)) throw new Error(`Claude Code run already exists: ${runId}`)
          const runOptions = optionalRecord(input.options) as Partial<Options>
          const running = sdk.query({
            prompt: onePrompt(prompt),
            options: { ...options.options, ...refOptions, ...runOptions }
          })
          active.set(runId, running)
          const messages: SDKMessage[] = []
          try {
            for await (const message of running) {
              messages.push(message)
              await Effect.runPromise(PubSub.publish(eventBus, {
                connectionId: spec.id,
                adapter: kind,
                kind: "claude-code.message",
                payload: { runId, message }
              }))
            }
          } finally {
            active.delete(runId)
          }
          const result = messages.findLast((message) => message.type === "result")
          const initialized = messages.find((message) => message.type === "system" && message.subtype === "init")
          return {
            runId,
            sessionId: result?.session_id ?? initialized?.session_id,
            result,
            messages
          }
        },
        catch: (cause) => cause instanceof Error ? cause : new Error(String(cause))
      })

      const invoke = (capability: string, unknownInput: unknown): Effect.Effect<unknown, Error> => {
        const input = record(unknownInput)
        switch (capability) {
          case ClaudeCodeCapabilities.run: return run(input)
          case ClaudeCodeCapabilities.interrupt: return withActive(input, (running) => running.interrupt())
          case ClaudeCodeCapabilities.setPermissionMode:
            return withActive(input, (running) => running.setPermissionMode(requiredString(input, "mode") as PermissionMode))
          case ClaudeCodeCapabilities.setMcpPermissionMode:
            return withActive(input, (running) => running.setMcpPermissionModeOverride(
              requiredString(input, "server"),
              (input.mode === null ? null : requiredString(input, "mode")) as "default" | "auto" | null
            ))
          case ClaudeCodeCapabilities.setModel:
            return withActive(input, (running) => running.setModel(typeof input.model === "string" ? input.model : undefined))
          case ClaudeCodeCapabilities.setThinking:
            return withActive(input, (running) => running.setMaxThinkingTokens(
              input.maxTokens === null ? null : Number(input.maxTokens),
              input.display as "summarized" | "omitted" | null | undefined
            ))
          case ClaudeCodeCapabilities.applySettings:
            return withActive(input, (running) => running.applyFlagSettings(optionalRecord(input.settings) as any))
          case ClaudeCodeCapabilities.initialize: return withActive(input, (running) => running.initializationResult())
          case ClaudeCodeCapabilities.reinitialize: return withActive(input, (running) => running.reinitialize())
          case ClaudeCodeCapabilities.commands: return withActive(input, (running) => running.supportedCommands())
          case ClaudeCodeCapabilities.models: return withActive(input, (running) => running.supportedModels())
          case ClaudeCodeCapabilities.agents: return withActive(input, (running) => running.supportedAgents())
          case ClaudeCodeCapabilities.mcpStatus: return withActive(input, (running) => running.mcpServerStatus())
          case ClaudeCodeCapabilities.contextUsage: return withActive(input, (running) => running.getContextUsage())
          case ClaudeCodeCapabilities.readFile:
            return withActive(input, (running) => running.readFile(requiredString(input, "path"), optionalRecord(input.options) as any))
          case ClaudeCodeCapabilities.reloadPlugins: return withActive(input, (running) => running.reloadPlugins())
          case ClaudeCodeCapabilities.reloadSkills: return withActive(input, (running) => running.reloadSkills())
          case ClaudeCodeCapabilities.account: return withActive(input, (running) => running.accountInfo())
          case ClaudeCodeCapabilities.rewindFiles:
            return withActive(input, (running) => running.rewindFiles(requiredString(input, "userMessageId"), optionalRecord(input.options)))
          case ClaudeCodeCapabilities.seedReadState:
            return withActive(input, (running) => running.seedReadState(requiredString(input, "path"), Number(input.mtime)))
          case ClaudeCodeCapabilities.backgroundTasks:
            return withActive(input, (running) => running.backgroundTasks(typeof input.toolUseId === "string" ? input.toolUseId : undefined))
          case ClaudeCodeCapabilities.sessionsList:
            return promiseEffect(() => sdk.listSessions(optionalRecord(input.options) as any))
          case ClaudeCodeCapabilities.sessionInfo:
            return promiseEffect(() => sdk.getSessionInfo(requiredString(input, "sessionId"), optionalRecord(input.options)))
          case ClaudeCodeCapabilities.sessionMessages:
            return promiseEffect(() => sdk.getSessionMessages(requiredString(input, "sessionId"), optionalRecord(input.options)))
          case ClaudeCodeCapabilities.sessionRename:
            return promiseEffect(() => sdk.renameSession(requiredString(input, "sessionId"), requiredString(input, "title"), optionalRecord(input.options)))
          case ClaudeCodeCapabilities.sessionTag:
            return promiseEffect(() => sdk.tagSession(
              requiredString(input, "sessionId"),
              input.tag === null ? null : requiredString(input, "tag"),
              optionalRecord(input.options)
            ))
          case ClaudeCodeCapabilities.sessionFork:
            return promiseEffect(() => sdk.forkSession(requiredString(input, "sessionId"), optionalRecord(input.options)))
          case ClaudeCodeCapabilities.sessionDelete:
            return promiseEffect(() => sdk.deleteSession(requiredString(input, "sessionId"), optionalRecord(input.options)))
          default: return Effect.fail(new Error(`Unsupported Claude Code capability: ${capability}`))
        }
      }

      return {
        connectionId: spec.id,
        adapter: kind,
        capabilities: allCapabilities,
        invoke,
        events: Stream.fromPubSub(eventBus),
        close: Effect.sync(() => {
          for (const running of active.values()) running.close()
          active.clear()
        }).pipe(Effect.zipRight(PubSub.shutdown(eventBus)))
      } satisfies ConnectionSession
    })
  }
}

export const claudeCodeConnectionSpec = (options: {
  readonly id: string
  readonly adapters: ReadonlyArray<AdapterRef>
  readonly capabilities?: ReadonlyArray<ClaudeCodeCapability>
}): ConnectionSpec => ({
  id: options.id,
  contract: {
    protocol: "claude-agent-sdk",
    capabilities: (options.capabilities ?? ClaudeCodeCapabilityGroups.run)
      .map((capability) => capabilitySpecs[capability])
  },
  adapters: options.adapters,
  selection: { strategy: "failover" }
})
