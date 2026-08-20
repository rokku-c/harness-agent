import { Context as EffectContext, Data, Effect, Either, JSONSchema, Layer, Option, Ref, Schema } from "effect"
import { AgentDefaults } from "./defaults.js"
import type { Gate, Stage } from "./orchestration.js"

/* ────────────────────────── 认知层（数据） ────────────────────────── */

/** Persistent instructions — identity, rules, guardrails. Stable across the whole run. */
export type Always = { readonly _tag: "Always"; readonly text: string }

/** Current-turn state — task input and injected binding content. */
export type Entry =
  | { readonly _tag: "Text"; readonly text: string }
  | { readonly _tag: "Object"; readonly value: unknown }

/** Internally observed process — thinking, intermediate text, tool calls. Populated by drivers when supported. */
export type Detail =
  | { readonly _tag: "Thinking"; readonly text: string }
  | { readonly _tag: "Text"; readonly text: string }
  | { readonly _tag: "ToolCall"; readonly id: string; readonly name: string; readonly input: unknown }
  | { readonly _tag: "ToolResult"; readonly id: string; readonly name: string; readonly output: unknown }

/* ────────────────────────── 世界层（注入） ────────────────────────── */

export interface Op<I, O, E = never, R = never> {
  readonly name: string
  readonly description: string
  readonly input: Schema.Schema<I, any, never>
  readonly output: Schema.Schema<O, any, never>
  readonly access: "read" | "write"
  readonly execute: (input: I) => Effect.Effect<O, E, R>
}

export const Op = {
  read: <I, O, E = never, R = never>(spec: Omit<Op<I, O, E, R>, "access">): Op<I, O, E, R> => ({ ...spec, access: "read" }),
  write: <I, O, E = never, R = never>(spec: Omit<Op<I, O, E, R>, "access">): Op<I, O, E, R> => ({ ...spec, access: "write" })
}

export interface Binding<A = never, E = never, R = never> {
  readonly uri: string
  readonly read?: Effect.Effect<Entry, E, R>
  readonly typed?: Effect.Effect<A, E, R>
  /** Ops 的 R 与 Binding 的 R 关联，使 uses() 能收集「agent 作为工具」的依赖。 */
  readonly ops?: ReadonlyArray<Op<any, any, any, R>>
}

/** A container is a bounded world of bindings — one workspace / one tool set. Zero to many are injected. */
export interface Container {
  readonly uri: string
  readonly bindings: ReadonlyMap<string, Binding<any, any, any>>
}

export const makeContainer = (uri: string, bindings: ReadonlyArray<Binding<any, any, any>>): Container => ({
  uri,
  bindings: new Map(bindings.map((binding) => [binding.uri, binding]))
})

export interface ContainersService {
  readonly containers: ReadonlyArray<Container>
  readonly resolve: (uri: string) => Option.Option<Container>
  readonly bindings: ReadonlyArray<Binding<any, any, any>>
  readonly ops: ReadonlyArray<Op<any, any, any, any>>
}

export const makeContainers = (containers: ReadonlyArray<Container>): ContainersService => {
  const byUri = new Map(containers.map((container) => [container.uri, container]))
  const bindings = containers.flatMap((container) => [...container.bindings.values()])
  return {
    containers,
    resolve: (uri) => Option.fromNullable(byUri.get(uri)),
    bindings,
    ops: bindings.flatMap((binding) => binding.ops ?? [])
  }
}

/** Injected 0..N containers — the tool worlds the agent can touch. */
export class Containers extends EffectContext.Tag("Context/Containers")<Containers, ContainersService>() {
  static empty = EffectContext.make(this, makeContainers([]))
  static layer(containers: ReadonlyArray<Container>): Layer.Layer<Containers> {
    return Layer.effect(this, Effect.succeed(makeContainers(containers)))
  }
}

export class ConnectionError extends Data.TaggedError("ConnectionError")<{
  readonly uri: string
  readonly cause: unknown
  readonly message?: string
}> {}

export interface RemoteRequest {
  readonly method: string
  readonly params: unknown
}

export interface RemoteResponse {
  readonly value: unknown
}

export type RemoteEvent =
  | { readonly _tag: "Open" }
  | { readonly _tag: "Request"; readonly request: RemoteRequest }
  | { readonly _tag: "Response"; readonly response: RemoteResponse }

/**
 * A connection is a transport/session to a remote resource. Once opened it yields the
 * remote world as Containers, so a remote filesystem or shell behaves like a local one.
 */
export interface Connection {
  readonly uri: string
  readonly open: Effect.Effect<ContainersService, ConnectionError, never>
  readonly request: (request: RemoteRequest) => Effect.Effect<RemoteResponse, ConnectionError, never>
  readonly events: ReadonlyArray<RemoteEvent>
}

export interface ConnectionsService {
  readonly connections: ReadonlyArray<Connection>
  readonly resolve: (uri: string) => Option.Option<Connection>
}

export const makeConnections = (connections: ReadonlyArray<Connection>): ConnectionsService => {
  const byUri = new Map(connections.map((connection) => [connection.uri, connection]))
  return {
    connections,
    resolve: (uri) => Option.fromNullable(byUri.get(uri))
  }
}

/** Injected 0..N connections — remote resources accessed as if local. */
export class Connections extends EffectContext.Tag("Context/Connections")<Connections, ConnectionsService>() {
  static empty = EffectContext.make(this, makeConnections([]))
  static layer(connections: ReadonlyArray<Connection>): Layer.Layer<Connections> {
    return Layer.effect(this, Effect.succeed(makeConnections(connections)))
  }
}

export interface Access<R = never> {
  readonly binding: Binding<any, any, R>
  readonly write: boolean
}

export const Uri = {
  make: (registry: string, kind: string, identity: string, subresource = "") =>
    `ea://${registry}/${kind}/${encodeURIComponent(identity)}${subresource ? `/${subresource}` : ""}`
}

/**
 * A runtime-derived sub-agent: a child `Agent` the running driver may spawn on demand.
 * The driver injects a `delegate` tool; when the parent model calls it with a goal, the
 * driver builds a child `Context` from this contract and runs it.
 */
export interface SubagentProgram {
  readonly id: string
  readonly until: Until<any>
  readonly access: ReadonlyArray<Access<any>>
  readonly context: (goal: string) => Context
}

/* ────────────────────────── 抽象 Context ────────────────────────── */

export type Until<A> =
  /** 推进到第 at 个阶段（可选），拿工具调用。 */
  | { readonly _tag: "ToolCall"; readonly at?: number }
  /** 推进到产出符合 schema。 */
  | { readonly _tag: "Schema"; readonly schema: Schema.Schema<A, any, never> }
  /** 完整跑完，不中途拿。 */
  | { readonly _tag: "Stop" }
  /** 兼容旧语义：推进到出现文本。 */
  | { readonly _tag: "Text" }
  /** 兼容旧语义：推进到出现思考。 */
  | { readonly _tag: "Thinking" }

export const Until = {
  /** 推进到第 at 个阶段（可选），拿工具调用。 */
  toolCall: (at?: number): Until<Extract<Detail, { _tag: "ToolCall" }>> => ({ _tag: "ToolCall", at }),
  /** 推进到产出符合 schema。 */
  schema: <A>(schema: Schema.Schema<A, any, never>): Until<A> => ({ _tag: "Schema", schema }),
  /** 完整跑完，不中途拿。 */
  stop: { _tag: "Stop" } as Until<string>,
  /** 推进到出现文本（兼容）。 */
  text: { _tag: "Text" } as Until<string>,
  /** 推进到出现思考（兼容）。 */
  thinking: { _tag: "Thinking" } as Until<string>
}

export interface ContextInit {
  readonly always: ReadonlyArray<Always>
  readonly current: ReadonlyArray<Entry>
  readonly until?: Until<any>
  readonly access?: ReadonlyArray<Access<any>>
  readonly subagents?: ReadonlyArray<SubagentProgram>
  readonly details?: ReadonlyArray<Detail>
  readonly containers?: ContainersService
  readonly connections?: ConnectionsService
  /** 执行编排：推进路径。 */
  readonly stages?: Stage
  /** 执行编排：按阶段解锁。 */
  readonly gates?: ReadonlyArray<Gate>
}

/**
 * The unified abstract context of an agent run: what the agent is given (cognitive layer),
 * what it can touch (injected world layer), and what it actually did (observation layer).
 * It is the single source of truth; drivers project it into their specific context.
 */
export class Context {
  static empty = new Context({ always: [], current: [] })
  /** Persistent instruction, projected as the native system prompt when the driver supports one. */
  static always(text: string) { return new Context({ always: [{ _tag: "Always", text }], current: [] }) }
  /** Current-turn task input. */
  static current(text: string) { return new Context({ always: [], current: [{ _tag: "Text", text }] }) }
  /** Structured current-turn input. Drivers render it without requiring business prompt construction. */
  static input(value: unknown) { return new Context({ always: [], current: [{ _tag: "Object", value }] }) }
  constructor(readonly init: ContextInit) {}
  get always() { return this.init.always }
  get current() { return this.init.current }
  get until() { return this.init.until }
  get access() { return this.init.access ?? [] }
  get subagents() { return this.init.subagents ?? [] }
  get details() { return this.init.details ?? [] }
  get containers(): Option.Option<ContainersService> { return Option.fromNullable(this.init.containers) }
  get connections(): Option.Option<ConnectionsService> { return Option.fromNullable(this.init.connections) }
  get stages(): Stage | undefined { return this.init.stages }
  get gates(): ReadonlyArray<Gate> { return this.init.gates ?? [] }
  /** Persistent instruction text, or undefined when none was set. */
  get alwaysText() {
    return this.always.find((entry): entry is Always => entry._tag === "Always")?.text ?? AgentDefaults.instructions
  }
  get lastText() {
    return this.current.findLast((entry): entry is Extract<Entry, { _tag: "Text" }> => entry._tag === "Text")?.text
  }
  appendCurrent(...entries: ReadonlyArray<Entry>) {
    return new Context({ ...this.init, current: [...this.current, ...entries] })
  }
  withUntil(until: Until<any>) {
    return new Context({ ...this.init, until })
  }
  withStages(stages: Stage | undefined) {
    return new Context({ ...this.init, stages })
  }
  withGates(gates: ReadonlyArray<Gate> | undefined) {
    return new Context({ ...this.init, gates })
  }
  withAccess(access: ReadonlyArray<Access<any>>) {
    return new Context({ ...this.init, access })
  }
  withSubagents(subagents: ReadonlyArray<SubagentProgram>) {
    return new Context({ ...this.init, subagents })
  }
  withDetails(details: ReadonlyArray<Detail>) {
    return new Context({ ...this.init, details })
  }
  withWorld(containers: ContainersService, connections: ConnectionsService) {
    return new Context({ ...this.init, containers, connections })
  }
  /** Renders the persistent instructions (without current state), or empty when unset. */
  renderSystem() {
    const text = this.alwaysText
    return text === undefined ? "" : `Always: ${text}`
  }
  render() {
    return this.current
      .map((entry) => entry._tag === "Text"
        ? `Text: ${entry.text}`
        : `Object: ${JSON.stringify(entry.value)}`).join("\n")
  }
}

/** Backward-compatible alias. */
export const AgentContext = Context

/* ────────────────────────── Capabilities ────────────────────────── */

export type Granularity = "event" | "turn" | "run"
export type ToolInjection = "native" | "mcp" | "none"
export type StructuredOutput = "native" | "tool" | "text" | "none"

export interface Capabilities {
  readonly provider:
    | { readonly _tag: "Configurable" }
    | { readonly _tag: "Fixed"; readonly api: string }
  readonly granularity: Granularity
  readonly thinking: boolean
  readonly cancel: boolean
  readonly pause: boolean
  /** Whether a completed session can be resumed. Independent of `fork`:
   *  e.g. Codex resumes an external thread (`resumeThread`) without exposing in-process forks. */
  readonly resume: boolean
  /** Whether the driver can fork a running agent into new branches:
   *  "node" = context-node fork, "session" = full session clone, "none" = no fork. */
  readonly fork: "node" | "session" | "none"
  readonly tools: ToolInjection
  readonly toolCalls: "intercept" | "observe" | "none"
  readonly structuredOutput: StructuredOutput
  readonly sandbox: "enforced" | "delegated" | "none"
  /** Whether the driver can run runtime-derived sub-agents (delegate at call time). */
  readonly subagents: boolean
}

export class UnsupportedCapability extends Data.TaggedError("UnsupportedCapability")<{
  readonly agent: string
  readonly required: string
  readonly actual: string
}> {}

export class AgentFailure extends Data.TaggedError("AgentFailure")<{
  readonly agent: string
  readonly cause: unknown
  readonly message?: string
}> {}

export type AgentError = UnsupportedCapability | AgentFailure

/* ────────────────────────── Driver & Session ────────────────────────── */

export type DriverEvent = {
  readonly _tag: "DriverPrepared"
  readonly agent: string
  readonly runtime: string
  readonly details: Readonly<Record<string, unknown>>
}

export interface DriverContext {
  readonly context: Context
  readonly report?: (event: DriverEvent) => Effect.Effect<void, AgentError, never>
}

/** The result of an agent run: the decoded output plus the observed process. */
export type Result<O> = { readonly output: O; readonly details: ReadonlyArray<Detail> }

/** A single observable boundary advanced by one step. */
export type StepEvent =
  | { readonly _tag: "Detail"; readonly detail: Detail }
  | { readonly _tag: "Result"; readonly value: unknown }

/**
 * A driver session: the running external agent exposed as an iterator.
 * Each `step` advances to the next observable boundary (per the driver's granularity)
 * and yields a detail, or the final result.
 */
export interface DriverSession<R = never> {
  readonly step: Effect.Effect<StepEvent, AgentError, R>
}

/** A driver projects the abstract Context into its specific SDK and iterates it. */
export interface Driver<RD = never> {
  readonly id: string
  readonly capabilities: Capabilities
  readonly start: (request: DriverContext) => Effect.Effect<DriverSession, AgentError, RD>
}

/**
 * User-facing iterative session. `run` repeatedly advances the driver session,
 * collecting details, until the driver yields a result.
 */
export class Session {
  constructor(
    readonly context: Context,
    readonly driverSession: DriverSession,
    readonly detailsRef: Ref.Ref<ReadonlyArray<Detail>>
  ) {}
  /** Advance one step; collect a detail if one was produced. */
  step() {
    return this.driverSession.step.pipe(
      Effect.tap((event) => event._tag === "Detail"
        ? Ref.update(this.detailsRef, (details) => [...details, event.detail])
        : Effect.void)
    )
  }
  /** Iterate until the driver yields a result, collecting details along the way. */
  run<O>(): Effect.Effect<Result<O>, AgentError, never> {
    const go = (): Effect.Effect<Result<O>, AgentError, never> =>
      this.driverSession.step.pipe(
        Effect.flatMap((event) => {
          if (event._tag === "Detail") {
            return Ref.update(this.detailsRef, (details) => [...details, event.detail]).pipe(Effect.flatMap(() => go()))
          }
          return this.detailsRef.get.pipe(Effect.map((details) => ({ output: event.value as O, details })))
        })
      )
    return go()
  }
}

export const report = (request: DriverContext, event: DriverEvent) =>
  request.report?.(event) ?? Effect.void

/** Convenience: start a driver session and iterate to the result in one call. */
export const runDriver = <O>(
  driver: Driver,
  context: Context
): Effect.Effect<Result<O>, AgentError, never> => Effect.gen(function*() {
  const driverSession = yield* driver.start({ context })
  const detailsRef = yield* Ref.make<ReadonlyArray<Detail>>([])
  return yield* new Session(context, driverSession, detailsRef).run<O>()
})

/** Materialize binding reads into the context, preserving each read's error channel `E`.
 *  Callers (drivers) map `E` to `AgentFailure` as appropriate. */
export const materialize = <E, R>(request: DriverContext): Effect.Effect<DriverContext, E, R> =>
  Effect.forEach(request.context.access, ({ binding }) =>
    binding.read ? Effect.map(binding.read, (value): ReadonlyArray<Entry> => [value]) : Effect.succeed([] as ReadonlyArray<Entry>),
  { concurrency: "unbounded" }).pipe(
    Effect.map((nested) => ({ ...request, context: request.context.appendCurrent(...nested.flat()) }))
  )

/* ────────────────────────── Agent program ────────────────────────── */

export interface AgentProgram<I, O, E = AgentError, R = never> {
  readonly id: string
  readonly capabilities: Capabilities
  readonly run: (input: I) => Effect.Effect<Result<O>, E, R>
}

export const requireUntil = <A>(id: string, capabilities: Capabilities, until: Until<A> | undefined): Effect.Effect<void, AgentError, never> => {
  if (!until) return Effect.void
  const reject = (required: string, actual: string) =>
    Effect.fail(new UnsupportedCapability({ agent: id, required, actual }))
  switch (until._tag) {
    case "Text": return capabilities.pause
      ? Effect.void
      : reject("pause at next text", `${capabilities.granularity}, pause=false`)
    case "Thinking": return capabilities.thinking && capabilities.pause
      ? Effect.void
      : reject("pause at next thinking", capabilities.thinking ? "pause=false" : "not exposed")
    case "ToolCall": return capabilities.toolCalls === "intercept"
      ? Effect.void
      : reject("pre-execution tool call", capabilities.toolCalls)
    case "Schema": return capabilities.structuredOutput !== "none"
      ? Effect.void
      : reject("structured output", "none")
    default: return Effect.void
  }
}

export const requireSubagents = (id: string, capabilities: Capabilities, subagents: ReadonlyArray<SubagentProgram>): Effect.Effect<void, AgentError, never> =>
  subagents.length > 0 && !capabilities.subagents
    ? Effect.fail(new UnsupportedCapability({ agent: id, required: "subagents", actual: "subagents=false" }))
    : Effect.void

export const schemaJson = <A>(schema: Schema.Schema<A, any, never>) => JSONSchema.make(schema)

const SANITIZE = /[^a-zA-Z0-9_-]/g

/**
 * Uniform tool-name construction shared by all drivers.
 * Sanitizes `opName` to `[a-zA-Z0-9_-]` and prepends `prefix` when it is a non-empty string.
 * `prefix === false` or `undefined` means no prefix.
 */
export const toolName = (opName: string, prefix?: string | false): string => {
  const name = opName.replace(SANITIZE, "_")
  return prefix && prefix.length > 0 ? `${prefix}${name}` : name
}

export const decode = <A>(schema: Schema.Schema<A, any, never>, value: unknown) =>
  Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError((cause) => new AgentFailure({ agent: "schema", cause }))
  )

export const decodeJson = <A>(schema: Schema.Schema<A, any, never>, text: string) => {
  const parsed = Either.try(() => JSON.parse(text) as unknown)
  return Either.isLeft(parsed)
    ? Effect.fail(new AgentFailure({ agent: "schema", cause: parsed.left }))
    : decode(schema, parsed.right)
}
