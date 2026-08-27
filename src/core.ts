import { Data, Effect, Either, JSONSchema, Schema } from "effect"

export type Content =
  | { readonly _tag: "Text"; readonly text: string }
  | { readonly _tag: "Thinking"; readonly text: string }
  | { readonly _tag: "ToolCall"; readonly id: string; readonly name: string; readonly input: unknown }
  | { readonly _tag: "ToolResult"; readonly id: string; readonly name: string; readonly output: unknown }
  | { readonly _tag: "Object"; readonly value: unknown }

export class AgentContext {
  static empty = new AgentContext([])
  static text(text: string) { return new AgentContext([{ _tag: "Text", text }]) }
  constructor(readonly entries: ReadonlyArray<Content>) {}
  append(...entries: ReadonlyArray<Content>) { return new AgentContext([...this.entries, ...entries]) }
  get lastText() {
    return this.entries.findLast((entry): entry is Extract<Content, { _tag: "Text" }> => entry._tag === "Text")?.text
  }
  render() {
    return this.entries.map((entry) => entry._tag === "Text" || entry._tag === "Thinking"
      ? `${entry._tag}: ${entry.text}`
      : `${entry._tag}: ${JSON.stringify(entry)}`).join("\n")
  }
}

export type Granularity = "event" | "turn" | "run"
export type ToolInjection = "native" | "mcp" | "none"
export type StructuredOutput = "native" | "tool" | "text" | "none"

/**
 * Declared driver capabilities. cancel/pause/resume/fork are capability-level
 * declarations: the kernel exposes no runtime surface for them (no abort/pause/
 * fork control) until the P1 event/pause protocol lands. Driver options may
 * partially back them (e.g. codex/claude-code resume pass through make()-time
 * options); that passthrough is not a kernel surface and must not be read as one.
 */
export interface Capabilities {
  readonly provider:
    | { readonly _tag: "Configurable" }
    | { readonly _tag: "Fixed"; readonly api: string }
  readonly granularity: Granularity
  readonly thinking: boolean
  readonly cancel: boolean
  readonly pause: boolean
  readonly resume: boolean
  readonly fork: "node" | "session" | "none"
  readonly tools: ToolInjection
  readonly toolCalls: "intercept" | "observe" | "none"
  readonly structuredOutput: StructuredOutput
  readonly sandbox: "enforced" | "delegated" | "none"
}

export type Until<A> =
  | { readonly _tag: "Text" }
  | { readonly _tag: "Thinking" }
  | { readonly _tag: "ToolCall" }
  | { readonly _tag: "Stop" }
  | { readonly _tag: "Schema"; readonly schema: Schema.Schema<A, any, never> }

export const Until = {
  text: { _tag: "Text" } as Until<string>,
  thinking: { _tag: "Thinking" } as Until<string>,
  toolCall: { _tag: "ToolCall" } as Until<Extract<Content, { _tag: "ToolCall" }>>,
  stop: { _tag: "Stop" } as Until<string>,
  schema: <A>(schema: Schema.Schema<A, any, never>): Until<A> => ({ _tag: "Schema", schema })
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
  readonly read?: Effect.Effect<Content, E, R>
  readonly typed?: Effect.Effect<A, E, R>
  readonly ops?: ReadonlyArray<Op<any, any, any, any>>
  readonly write?: (value: A) => Effect.Effect<void, E, R>
}

/** A Binding that can commit a deterministic value (DRAFT 6.4). */
export interface WritableBinding<A = never, E = never, R = never> extends Binding<A, E, R> {
  readonly write: (value: A) => Effect.Effect<void, E, R>
}

export class Container {
  readonly #bindings: ReadonlyMap<string, Binding<any, any, any>>
  constructor(bindings: Iterable<Binding<any, any, any>>) {
    this.#bindings = new Map(Array.from(bindings, (binding) => [binding.uri, binding]))
  }
  get(uri: string) { return this.#bindings.get(uri) }
  list() { return [...this.#bindings.values()] }
}

export interface Connection {
  readonly uri: string
  readonly open: Effect.Effect<Container, unknown, any>
}

export const Uri = {
  make: (registry: string, kind: string, identity: string, subresource = "") =>
    `ea://${registry}/${kind}/${encodeURIComponent(identity)}${subresource ? `/${subresource}` : ""}`
}

export interface Access<R = never> {
  readonly binding: Binding<any, any, R>
  readonly write: boolean
}

export interface RunRequest<A, R = never> {
  readonly context: AgentContext
  readonly until: Until<A>
  readonly access: ReadonlyArray<Access<R>>
  readonly report?: (event: DriverEvent) => Effect.Effect<void, AgentError, R>
}

export type DriverEvent = {
  readonly _tag: "DriverPrepared"
  readonly agent: string
  readonly runtime: string
  readonly details: Readonly<Record<string, unknown>>
}

export const report = <A, R>(request: RunRequest<A, R>, event: DriverEvent) =>
  request.report?.(event) ?? Effect.void

export const materialize = <A, R>(request: RunRequest<A, R>) => Effect.gen(function*() {
  const content = yield* Effect.forEach(request.access, ({ binding }) =>
    binding.read ? Effect.map(binding.read, (value) => [value]) : Effect.succeed([] as ReadonlyArray<Content>),
  { concurrency: "unbounded" })
  return { ...request, context: request.context.append(...content.flat()) }
})

/**
 * Commit a deterministic Schema result to every declared-write binding
 * (DRAFT 6.4 / docs/writable.md D3). Each write:true access receives the same
 * decoded output; the first failure fails the run wrapped as AgentFailure.
 * Text/stop outputs have no deterministic structure and are never committed
 * (P1 candidate: text-output commit).
 */
export const commitSchemaResult = <A, R>(request: RunRequest<A, R>, value: A, agent: string): Effect.Effect<void, AgentError, R> =>
  Effect.forEach(
    request.access
      .filter(({ write, binding }) => write && typeof binding.write === "function")
      .map(({ binding }) => binding.write as (value: A) => Effect.Effect<void, unknown, R>),
    (write) => write(value)
  ).pipe(
    Effect.mapError((cause) => new AgentFailure({ agent, cause })),
    Effect.asVoid
  )

export interface AgentProgram<I, O, E = AgentError, R = never> {
  readonly id: string
  readonly capabilities: Capabilities
  readonly run: (input: I) => Effect.Effect<O, E, R>
}

export interface Driver<RD = never> {
  readonly id: string
  readonly capabilities: Capabilities
  readonly run: <A, R>(request: RunRequest<A, R>) => Effect.Effect<A, AgentError, R | RD>
}

export const requireUntil = <A>(id: string, capabilities: Capabilities, until: Until<A>) => {
  const reject = (required: string, actual: string) =>
    Effect.fail(new UnsupportedCapability({ agent: id, required, actual }))
  switch (until._tag) {
    // DRAFT 12.1: Until.text returns the next Text segment; pausing at the hit
    // is only required when the caller wants to stop there. Observational
    // (run-to-completion) semantics need only the Text event, which every
    // driver's final response satisfies, so no pause capability is required.
    case "Text": return Effect.void
    // DRAFT 12.2: Until.thinking requires the agent to expose Thinking.
    case "Thinking": return capabilities.thinking
      ? Effect.void
      : reject("thinking event", "not exposed")
    // DRAFT 12.3: Until.toolCall must guarantee the call is not executed yet;
    // observe-mode tool calls are post-execution reports and do not qualify.
    case "ToolCall": return capabilities.toolCalls === "intercept"
      ? Effect.void
      : reject("pre-execution tool call", capabilities.toolCalls)
    case "Schema": return capabilities.structuredOutput !== "none"
      ? Effect.void
      : reject("structured output", "none")
    default: return Effect.void
  }
}

export const schemaJson = <A>(schema: Schema.Schema<A, any, never>) => JSONSchema.make(schema)

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
