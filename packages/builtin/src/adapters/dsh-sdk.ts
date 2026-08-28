import { Data, Effect, PubSub, Stream } from "effect"
import type {
  AdapterRef,
  AdapterSelection,
  CapabilitySpec,
  ConnectionAdapter,
  ConnectionEvent,
  ConnectionSession,
  ConnectionSpec,
  JsonValue
} from "@effect-agent/core"

/**
 * dsh connection adapter (design docs/dsh-connection.md v2.1).
 *
 * Known limitations (see the design doc):
 * - Concurrent first-invoke race (core kernel): two fibers invoking a cold spec
 *   both run connect() and each spawns a dsh runtime; the later one wins the
 *   session map and the loser's client is never closed (subprocess leak). The
 *   kernel is not changed here; tests only record the behavior.
 * - events are best-effort: publish is dropped with no subscriber and the queue
 *   is unbounded for lagging subscribers. Notifications stream LIVE during the
 *   run via the SDK's onNotification callback (single event source); the phase-1
 *   RunResult.events replay was removed in B7.
 * - One connection = one serial agent process and one session line; no pool.
 */

/**
 * Structural surface of the DeepSeek Harness client this adapter needs. The
 * real @deepseek-ai/dsh-sdk-client satisfies it; tests inject a fake.
 * Injection-first: this module never imports the SDK package.
 */
export interface DshRunResultLike {
  readonly sessionId: string
  readonly finalResponse: string
  readonly events?: ReadonlyArray<unknown>
  readonly notifications?: ReadonlyArray<unknown>
}

export interface DshHarnessLike {
  /** Eager handshake with the runtime; must be idempotent and repeatable (the SDK memoizes it). */
  readonly start: () => Promise<void>
  readonly run: (input: string, options?: {
    readonly sessionId?: string
    /** Live observation channel: the SDK calls this for each runtime notification during the run. */
    readonly onNotification?: (notification: unknown) => void
  }) => Promise<DshRunResultLike>
  /** Reap the runtime subprocess; idempotent and terminal. */
  readonly close: () => Promise<void>
}

export const DshCapabilities = {
  agentRun: "dsh.agent.run"
} as const

export interface DshSdkAdapterOptions {
  /** Provide the real client (lazy construct); when absent, connect goes through loadDshSdk() once launch config is available. */
  readonly client?: () => DshHarnessLike
  /** Launch defaults; AdapterRef.config.launch takes priority, then DSH_ROOT. */
  readonly launch?: { readonly command: string; readonly args: string[] }
  readonly provider?: string
  readonly model?: string
  readonly maxTokens?: number
}

/**
 * Adapter errors keep the original cause plus structured wire/process fields
 * (JSON-RPC code/data; process exitCode and a stderr tail when the SDK exposes
 * them), with a message prefixed by "dsh adapter: ".
 */
export class DshConnectionError extends Data.TaggedError("DshConnectionError")<{
  readonly message: string
  readonly capability?: string
  readonly cause?: unknown
  readonly code?: number
  readonly data?: unknown
  readonly exitCode?: number
  readonly stderrTail?: string
}> {}

interface ResolvedConfig {
  readonly launch?: { readonly command: string; readonly args: string[] }
  readonly provider?: string
  readonly model?: string
  readonly maxTokens?: number
}

const recordOf = (input: unknown): Readonly<Record<string, unknown>> =>
  input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Readonly<Record<string, unknown>>
    : {}

const messageOf = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

const structuredOf = (cause: unknown) => {
  const record = recordOf(cause)
  return {
    code: typeof record.code === "number" ? record.code : undefined,
    data: "data" in record ? record.data : undefined,
    exitCode: typeof record.exitCode === "number" ? record.exitCode : undefined,
    stderrTail: typeof record.stderrTail === "string" ? record.stderrTail : undefined
  }
}

const connectionError = (message: string, cause: unknown, capability?: string): DshConnectionError =>
  new DshConnectionError({ message, capability, cause, ...structuredOf(cause) })

const launchOf = (value: unknown): { readonly command: string; readonly args: string[] } | undefined => {
  const record = recordOf(value)
  if (typeof record.command !== "string") return undefined
  const args = record.args
  return {
    command: record.command,
    args: Array.isArray(args) ? args.filter((arg): arg is string => typeof arg === "string") : []
  }
}

/**
 * DSH_ROOT fallback (design section 4.1): when neither the adapter options nor
 * AdapterRef.config provide a launch, point at a DeepSeek Harness checkout's
 * built SDK runtime (the dsh-jsonrpc-agent bin). Browser-safe: degrades to
 * undefined outside Node.
 */
const processEnv = (): Record<string, string | undefined> | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env

const dshRootFromEnv = (): string | undefined => processEnv()?.DSH_ROOT

const launchFromEnv = (): { readonly command: string; readonly args: string[] } | undefined => {
  const root = dshRootFromEnv()
  if (!root) return undefined
  const base = root.replace(/\/$/, "")
  // The SDK runtime subprocess is the built dsh-jsonrpc-agent bin; it requires a
  // cordis.yml, which arrives via DSH_CORDIS_CONFIG (the bin's own env channel,
  // which wins over argv) or explicitly through ref.config.launch.
  const runtimeBin = base + "/packages/examples/jsonrpc-demo/lib/bin.js"
  const cordis = processEnv()?.DSH_CORDIS_CONFIG
  return cordis === undefined || cordis === ""
    ? { command: "node", args: [runtimeBin] }
    : { command: "node", args: [runtimeBin, cordis] }
}

const resolveConfig = (options: DshSdkAdapterOptions, ref: AdapterRef): ResolvedConfig => {
  const record = recordOf(ref.config)
  // Fail loud on a malformed ref.config.launch instead of silently falling back
  // to options/env: a typo in the config must surface, not be masked.
  const configLaunch = record.launch === undefined ? undefined : launchOf(record.launch)
  if (record.launch !== undefined && configLaunch === undefined)
    throw new DshConnectionError({
      message: "dsh adapter: ref.config.launch is malformed (expected { command: string, args: string[] })"
    })
  return {
    launch: configLaunch ?? options.launch ?? launchFromEnv(),
    provider: typeof record.provider === "string" ? record.provider : options.provider,
    model: typeof record.model === "string" ? record.model : options.model,
    maxTokens: typeof record.maxTokens === "number" ? record.maxTokens : options.maxTokens
  }
}

/**
 * Lazy loader: dynamic-imports @deepseek-ai/dsh-sdk-client only when a real
 * connection is opened without an injected client. The package is not a
 * dependency; when missing the import fails here with a clear dsh-adapter
 * error instead of a module-resolution crash.
 */
const loadDshSdk = (
  launch: { readonly command: string; readonly args: string[] },
  config: ResolvedConfig
): Effect.Effect<DshHarnessLike, DshConnectionError> =>
  Effect.tryPromise({
    try: async () => {
      const sdk = await import("@deepseek-ai/dsh-sdk-client")
      return new sdk.DeepSeekHarness({
        launch: { command: launch.command, args: launch.args },
        ...(config.provider ? { provider: config.provider } : {}),
        ...(config.model ? { model: config.model } : {}),
        ...(config.maxTokens !== undefined ? { maxTokens: config.maxTokens } : {})
      })
    },
    catch: (cause) => connectionError(
      "dsh adapter: failed to load @deepseek-ai/dsh-sdk-client: " + messageOf(cause)
        + ". The client depends on 5 workspace peers of the deepseek-harness monorepo"
        + " (@deepseek-ai/cordis and friends, workspace:^ protocol) and cannot be installed"
        + " outside that checkout: inject a client via dshSdkAdapter({ client }), or clone"
        + " deepseek-harness and point DSH_ROOT at it.",
      cause
    )
  })

const acquireClient = (
  options: DshSdkAdapterOptions,
  config: ResolvedConfig
): Effect.Effect<DshHarnessLike, DshConnectionError> =>
  options.client
    ? Effect.try({
        try: options.client,
        catch: (cause) => connectionError("dsh adapter: client factory failed: " + messageOf(cause), cause)
      })
    : config.launch
      ? loadDshSdk(config.launch, config)
      : Effect.fail(new DshConnectionError({
          message: "dsh adapter: no launch config provided (inject a client, set ref.config.launch, or point DSH_ROOT at a DeepSeek Harness checkout)"
        }))

/**
 * Eager handshake, exposed early so a broken runtime fails connect() and the
 * kernel aggregates it into ConnectionOpenError / failover. On start failure
 * the half-open client is closed before the error propagates - the cleanup
 * role the design reserves for Effect.acquireRelease, written as tapError
 * because acquireRelease requires Scope, which the core's connect signature
 * (Effect<ConnectionSession, Error>) cannot carry.
 */
const startClient = (client: DshHarnessLike): Effect.Effect<void, DshConnectionError> =>
  Effect.tryPromise({
    try: () => client.start(),
    catch: (cause) => connectionError("dsh adapter: start failed: " + messageOf(cause), cause)
  }).pipe(
    Effect.tapError(() => Effect.tryPromise(() => client.close()).pipe(Effect.ignore))
  )

/**
 * Envelope check (design section 4.1): this capability's declared schema is
 * { prompt, sessionId }, so a legal direct input never carries an `input` key;
 * the key can only appear in the { input, agent } envelope that compile()
 * produces. If a future capability legitimately uses an `input` field, this
 * heuristic must be replaced by an explicit envelope marker.
 */
const isEnvelope = (value: unknown): value is { input: unknown } =>
  typeof value === "object" && value !== null && "input" in value

const publishNotification = (
  eventBus: PubSub.PubSub<ConnectionEvent>,
  connectionId: string,
  adapter: string,
  notification: unknown
): Effect.Effect<void, never> => {
  const record = recordOf(notification)
  const method = typeof record.method === "string" ? record.method : "unknown"
  // dsh.* method kinds mirror the SDK's notification method names 1:1
  // (session.event, session.status, subagent.started, ...) - see docs/dsh-connection.md.
  return PubSub.publish(eventBus, {
    connectionId,
    adapter,
    kind: "dsh." + method,
    payload: record.params
  })
}

const invokeClient = (
  client: DshHarnessLike,
  eventBus: PubSub.PubSub<ConnectionEvent>,
  connectionId: string,
  adapter: string,
  capability: string,
  raw: unknown
): Effect.Effect<unknown, DshConnectionError> => {
  switch (capability) {
    case DshCapabilities.agentRun: {
      const input = isEnvelope(raw) ? raw.input : raw
      const record = recordOf(input)
      // Fail loud on undeclared keys (schema declares additionalProperties: false).
      // Envelope keys (input/agent) are exempt because they were unwrapped above.
      const extra = Object.keys(record).filter((key) => key !== "prompt" && key !== "sessionId")
      if (extra.length > 0)
        return Effect.fail(new DshConnectionError({
          message: "dsh adapter: dsh.agent.run input carries undeclared keys: " + extra.join(", ")
            + " (schema declares only prompt, sessionId; envelope keys input/agent are unwrapped)",
          capability
        }))
      const prompt = record.prompt
      if (typeof prompt !== "string")
        return Effect.fail(new DshConnectionError({
          message: "dsh adapter: dsh.agent.run requires a string prompt",
          capability
        }))
      const sessionId = typeof record.sessionId === "string" ? record.sessionId : undefined
      // Always pass options: sessionId when present plus the live observation
      // callback. The callback must never throw - an uncaught throw would reject
      // the SDK run promise and kill the run (violating the observationality
      // invariant), so publish runs under runSync (strict FIFO wire order) inside
      // try/catch, and a publish failure is swallowed best-effort.
      const options = {
        ...(sessionId === undefined ? {} : { sessionId }),
        onNotification: (notification: unknown) => {
          try { Effect.runSync(publishNotification(eventBus, connectionId, adapter, notification)) }
          catch { /* best-effort: observation must never kill the run */ }
        }
      }
      return Effect.tryPromise({
        try: () => client.run(prompt, options),
        catch: (cause) => connectionError("dsh adapter: dsh.agent.run failed: " + messageOf(cause), cause, capability)
      }).pipe(Effect.flatMap((result) => {
        if (typeof result?.sessionId !== "string" || typeof result?.finalResponse !== "string")
          return Effect.fail(new DshConnectionError({
            message: "dsh adapter: dsh.agent.run returned an invalid result (expected { sessionId, finalResponse })",
            capability,
            cause: result
          }))
        // Single event source: live onNotification stream. RunResult.events is
        // kept on the result type for compat but is never replayed (B7).
        const output = { sessionId: result.sessionId, finalResponse: result.finalResponse }
        return Effect.succeed(output)
      }))
    }
    default:
      return Effect.fail(new DshConnectionError({
        message: "dsh adapter: unknown capability: " + capability,
        capability
      }))
  }
}

const requiredCapabilities = (spec: ConnectionSpec) => new Set([
  ...spec.contract.capabilities.map((capability) => capability.name),
  ...(spec.selection?.strategy === "capability" ? spec.selection.requires : [])
])

/**
 * Adapter factory (docs/dsh-connection.md v2.1). Phase 1 exposes exactly one
 * capability, dsh.agent.run; session.open was dropped in v2 (see design 2.2).
 *
 * Lifecycle follows the mcp-sdk pattern: connect() constructs the client and
 * eagerly start()s it (failure surfaces at connect time and joins the kernel's
 * ConnectionOpenError/failover), and the returned session owns a single
 * event PubSub whose shutdown is sequenced AFTER the client close - the
 * zipRight order matters: client.close() is Effect.ignore'd first so a close
 * failure cannot skip the PubSub shutdown (which would hang subscribed
 * streams). Stream.fromPubSub deliberately gets no { shutdown: true } so an
 * early-ending observer cannot kill the PubSub (a consumer-driven race).
 */
export const dshSdkAdapter = (options: DshSdkAdapterOptions = {}): ConnectionAdapter => {
  const kind = "builtin.dsh"
  const capabilities = new Set<string>([DshCapabilities.agentRun])
  return {
    kind,
    capabilities,
    connect: (spec, ref) => Effect.gen(function* () {
      const config = yield* Effect.try({
        try: () => resolveConfig(options, ref),
        catch: (cause) => cause instanceof DshConnectionError
          ? cause
          : connectionError("dsh adapter: invalid connection config: " + messageOf(cause), cause)
      })
      const client = yield* acquireClient(options, config)
      yield* startClient(client)
      const eventBus = yield* PubSub.unbounded<ConnectionEvent>()
      const required = requiredCapabilities(spec)
      const sessionCapabilities = new Set<string>([...capabilities].filter((capability) => required.has(capability)))
      return {
        connectionId: spec.id,
        adapter: kind,
        capabilities: sessionCapabilities,
        invoke: (capability, input) => invokeClient(client, eventBus, spec.id, kind, capability, input),
        events: Stream.fromPubSub(eventBus),
        close: Effect.tryPromise(() => client.close()).pipe(Effect.ignore).pipe(Effect.zipRight(PubSub.shutdown(eventBus)))
      } satisfies ConnectionSession
    })
  }
}

const agentRunCapability: CapabilitySpec = {
  name: DshCapabilities.agentRun,
  input: {
    type: "object",
    properties: { prompt: { type: "string" }, sessionId: { type: "string" } },
    required: ["prompt"],
    additionalProperties: false
  },
  output: {
    type: "object",
    properties: { sessionId: { type: "string" }, finalResponse: { type: "string" } },
    required: ["sessionId", "finalResponse"],
    additionalProperties: false
  },
  mode: "control",
  description: "Run one prompt on a DeepSeek Harness runtime session and return the final response. "
    + "finalResponse is the last root-session assistant text in the interval: on a fresh session "
    + "this equals prompt-to-response, but when reusing sessionId it may have no causal relation "
    + "to the prompt."
}

/** ConnectionSpec helper carrying the complete dsh.agent.run capability contract. */
export const dshConnectionSpec = (options: {
  readonly id: string
  readonly adapters: ReadonlyArray<AdapterRef>
  readonly selection?: AdapterSelection
  readonly metadata?: Readonly<Record<string, JsonValue>>
}): ConnectionSpec => ({
  id: options.id,
  contract: { protocol: "dsh", capabilities: [agentRunCapability] },
  adapters: options.adapters,
  ...(options.selection ? { selection: options.selection } : {}),
  ...(options.metadata ? { metadata: options.metadata } : {})
})
