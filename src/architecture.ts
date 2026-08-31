/**
 * The agent ARCHITECTURE - and its activation by notation.
 *
 * An architecture is an inert blueprint: which connections it accepts (the six
 * declaration modes), which other ARCHITECTURES it is built from, its prompt
 * as a NOTATION TARGET (never resolved prose), its loop bound. Defining what
 * an agent does is not design; the architecture is. Only after notation is
 * injected does the architecture become a truly executable agent.
 *
 * There is no LLM concept here. The model is a connection - a built-in
 * PROVIDER CONNECTION carrying the generate capability - resolved through the
 * same injectable surface as everything else.
 *
 * Effect-TS all the way down: the session log lives in Refs, the injection is
 * an Effect, the executable agent is a Context.Tag service constructed through
 * a Layer, and every operation returns an Effect with typed errors.
 */
import { Context, Effect, Layer, Ref } from "effect"
import type { BoundTool, Connection, ConnectionDecl, ConnectionSpec, ModelConnection, Tool } from "./connection.ts"
import { bind } from "./connection.ts"
import type { Message, Turn } from "./message.ts"
import { resolveNotation, type NotationStore } from "./notation.ts"

// ---------------------------------------------------------------------------
// Typed errors - failures are values, never throws.
// ---------------------------------------------------------------------------
/** A failed run: the loop bound was hit, or the model generation failed. */
export type AgentError =
  | { readonly _tag: "MaxStepsExceeded"; readonly agent: string; readonly steps: number }
  | { readonly _tag: "GenerateFailed"; readonly agent: string; readonly cause: unknown }

export type BindError = { readonly _tag: "BindFailed"; readonly agent: string; readonly cause: string }

export type InjectError =
  | { readonly _tag: "PromptUnresolved"; readonly target: string; readonly cause: string }
  | { readonly _tag: "DepFailed"; readonly agent: string; readonly cause: string }
  | BindError

// ---------------------------------------------------------------------------
// The executable agent shape - every agent carries it. The owner-facing
// controls (applyTools/updateSystemPrompt) are Effects; the model-facing
// surface of an agent-as-connection is invokeMessage.
// ---------------------------------------------------------------------------
export interface AgentShape {
  readonly name: string
  /** Apply tools: bind connections now - and re-bind any time (real-time). */
  readonly applyTools: (connections: ReadonlyArray<Connection>) => Effect.Effect<void, BindError>
  /** Update the system prompt (notation-injected text). */
  readonly updateSystemPrompt: (prompt: string) => Effect.Effect<void>
  /** Invoke: append a user message and run the loop to an assistant reply. */
  readonly invokeMessage: (content: string) => Effect.Effect<string, AgentError>
  /** The turn log. */
  readonly listTurns: Effect.Effect<ReadonlyArray<Turn>>
  /** The flat message log. */
  readonly listMessages: Effect.Effect<ReadonlyArray<Message>>
  /** The agent as a connection: the surface a parent agent binds. */
  readonly asConnection: Connection
}

/** The agent service - yield it inside Effect.gen, provide it through a Layer. */
export class Agent extends Context.Tag("effect-agent/Agent")<Agent, AgentShape>() {}

// ---------------------------------------------------------------------------
// The architecture: connections declared first, then composition, then the
// notation target. Pure data - nothing here resolves, binds, or runs.
// ---------------------------------------------------------------------------
export interface Architecture {
  /** The agent's name - its identity as a connection. */
  readonly name: string
  /** Declared FIRST: how this agent accepts connections (the six modes). */
  readonly connections: ConnectionSpec
  /** Mix-build: other architectures (injected recursively) or ready agents. */
  readonly agents?: ReadonlyArray<Architecture | AgentShape>
  /** The system prompt as a NOTATION TARGET - inert until injection. */
  readonly prompt: string
  /** Loop bound: fail after this many generation steps in one invocation. */
  readonly maxSteps?: number
}

/**
 * The blueprint as PURE DATA: unlike the runtime Architecture, `agents`
 * accepts only other blueprints - a ready agent (full of closures) cannot
 * even typecheck here. Combined with the deep inert-walk in `architect`,
 * this is the definition-time ban on console/fs/any code: an architecture
 * is data, and code enters only through connections at activation.
 */
export interface ArchitectureInput {
  readonly name: string
  readonly connections: ConnectionSpec
  readonly agents?: ReadonlyArray<ArchitectureInput>
  readonly prompt: string
  readonly maxSteps?: number
}

/**
 * Deep inert-walk: every value in the blueprint must be plain data. Rejects
 * functions (console/fs/execute closures), non-plain objects (class
 * instances like the node built-ins), accessor properties (getters run
 * code on read), and primitives outside the data set - with the precise
 * path of the offender.
 */
const assertInert = (name: string, value: unknown, path: string): void => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return
  if (typeof value === "function")
    throw new Error(
      `architecture "${name}": ${path} is a function - architectures are pure data; ${path === "architecture" ? "code enters through connections at activation" : "move this into a connection's tool execute (injected at activation)"}`
    )
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertInert(name, entry, `${path}[${index}]`))
    return
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null)
      throw new Error(`architecture "${name}": ${path} is not a plain object (prototype ${proto?.constructor?.name ?? "unknown"}) - architectures are pure data`)
    // Reflect.ownKeys: also catches non-enumerable accessors and symbol keys
    for (const key of Reflect.ownKeys(value)) {
      const desc = Object.getOwnPropertyDescriptor(value, key)
      if (desc !== undefined && (desc.get !== undefined || desc.set !== undefined))
        throw new Error(`architecture "${name}": ${path}.${String(key)} is an accessor property - architectures are pure data`)
      assertInert(name, desc?.value, `${path}.${String(key)}`)
    }
    return
  }
  throw new Error(`architecture "${name}": ${path} is ${typeof value} - not allowed in a pure-data architecture`)
}

/** Define an agent architecture - an inert blueprint, not a runnable thing. */
export const architect = (def: ArchitectureInput): ArchitectureInput => {
  assertInert(def.name, def, "architecture")
  return def
}

/**
 * The activation: notation (the prose layer), the model (a built-in provider
 * connection), and the initial connection pool. Injecting the notation is
 * what turns the architecture into a truly executable agent.
 */
export interface Activation {
  readonly notation: NotationStore
  readonly model: ModelConnection
  readonly connections?: ReadonlyArray<Connection>
  /** Interpolation variables for the notation targets ({team} etc.). */
  readonly vars?: Record<string, unknown>
}

const declNames = (decl: ConnectionDecl): string[] =>
  decl._tag === "Named" || decl._tag === "NamedShaped" ? [...decl.names] : []

type BoundTools = { tools: ReadonlyArray<BoundTool>; names: Map<string, BoundTool> }

/** Agent dependencies are static composition: bound at injection time. */
const depTools = (deps: ReadonlyArray<AgentShape>): BoundTools => {
  const names = new Map<string, BoundTool>()
  const tools: BoundTool[] = []
  for (const dep of deps) {
    const toolName = `${dep.name}__invokeMessage`
    const tool: Tool = {
      name: toolName,
      input: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
      output: { type: "string" },
      execute: (input: unknown) => dep.invokeMessage(String((input as { message: string }).message))
    }
    const bound: BoundTool = {
      ...tool,
      boundName: toolName,
      source: dep.name,
      // mechanical prose, not authored: the invocation surface names itself
      description: `Invoke the agent "${dep.name}" with a message.`
    }
    names.set(toolName, bound)
    tools.push(bound)
  }
  return { tools, names }
}

/**
 * Inject: turn an architecture into a truly executable agent by injecting
 * the notation (and the model provider + initial connections). The session
 * log lives in Refs; every later operation is an Effect over that state.
 */
export const inject = (architecture: Architecture, activation: Activation): Effect.Effect<AgentShape, InjectError> =>
  Effect.gen(function* () {
    // the model is a ModelConnection - the type system guarantees generate
    const generate = activation.model.generate

    // agent dependencies: architectures inject recursively with the same activation
    const deps: AgentShape[] = []
    for (const dep of architecture.agents ?? []) {
      if ("invokeMessage" in dep) {
        deps.push(dep)
        continue
      }
      const built = yield* Effect.mapError(
        inject(dep, activation),
        (cause): InjectError => ({ _tag: "DepFailed", agent: dep.name, cause: JSON.stringify(cause) })
      )
      deps.push(built)
    }

    // THE injection: the notation target resolves now - before this, the
    // architecture carries no prose and can do nothing.
    const initialPrompt = yield* Effect.try({
      try: () => resolveNotation(activation.notation, architecture.prompt, activation.vars) as string,
      catch: (cause): InjectError => ({ _tag: "PromptUnresolved", target: architecture.prompt, cause: String(cause) })
    })

    // session state: Refs, the Effect way
    const messages = yield* Ref.make<ReadonlyArray<Message>>([])
    const turns = yield* Ref.make<ReadonlyArray<Turn>>([])
    const prompt = yield* Ref.make(initialPrompt)
    const maxSteps = architecture.maxSteps ?? 8
    const agentBound = depTools(deps)
    const bound = yield* Ref.make<BoundTools>(agentBound)

    const rebind = (connections: ReadonlyArray<Connection>): Effect.Effect<void, BindError> =>
      Effect.try({
        try: () => {
          const specs = Object.entries(architecture.connections)
          const tools: BoundTool[] = []
          const names = new Map<string, BoundTool>()
          const claimed = new Set<string>()
          // two passes: specific slots (keyed / named / shaped / cascade)
          // match first; any-mode slots take the leftovers - so an any slot
          // cannot steal a connection a specific slot needs.
          const specific = specs.filter(([, decl]) => decl._tag !== "Any")
          const wildcard = specs.filter(([, decl]) => decl._tag === "Any")
          const matchOne = (key: string, decl: ConnectionDecl): Connection | undefined => {
            const accepted = declNames(decl)
            return connections.find((c) => c.name === key && !claimed.has(c.name))
              ?? (accepted.length > 0 ? connections.find((c) => accepted.includes(c.name) && !claimed.has(c.name)) : undefined)
          }
          for (const [key, decl] of [...specific, ...wildcard]) {
            const conn = decl._tag === "Any"
              ? connections.find((c) => !claimed.has(c.name))
              : matchOne(key, decl)
            if (conn === undefined)
              throw new Error(`connection "${key}" was not provided`)
            claimed.add(conn.name)
            for (const boundTool of bind(decl, conn)) {
              names.set(boundTool.boundName, boundTool)
              tools.push(boundTool)
            }
          }
          return { tools: [...tools, ...agentBound.tools], names: new Map([...names, ...agentBound.names]) }
        },
        catch: (cause): BindError => ({ _tag: "BindFailed", agent: architecture.name, cause: String(cause) })
      }).pipe(Effect.flatMap((next) => Ref.set(bound, next)))

    // the initial connection pool binds at injection
    if (activation.connections !== undefined) yield* rebind(activation.connections)

    const closeTurn = (turnStart: number, status: "complete" | "max-steps") =>
      Effect.gen(function* () {
        const log = yield* Ref.get(messages)
        yield* Ref.update(turns, (ts) => [...ts, { index: ts.length, messages: log.slice(turnStart), status }])
      })

    // one generation step: call the model, run its tool calls into the log,
    // or land the assistant reply and close the turn. A tool failure is fed
    // back to the model as a tool result (the retry path), never swallowed.
    const step = (turnStart: number, n: number): Effect.Effect<string, AgentError> =>
      Effect.gen(function* () {
        if (n >= maxSteps) {
          yield* closeTurn(turnStart, "max-steps")
          return yield* Effect.fail<AgentError>({ _tag: "MaxStepsExceeded", agent: architecture.name, steps: maxSteps })
        }
        const systemPrompt = yield* Ref.get(prompt)
        const log = yield* Ref.get(messages)
        const boundNow = yield* Ref.get(bound)
        const result = yield* Effect.mapError(
          generate(systemPrompt, log, boundNow.tools),
          (cause): AgentError => ({ _tag: "GenerateFailed", agent: architecture.name, cause })
        )
        yield* Ref.update(messages, (ms): ReadonlyArray<Message> =>
          [...ms, { role: "assistant", content: result.text, toolCalls: result.toolCalls }])
        if (result.toolCalls.length === 0) {
          yield* closeTurn(turnStart, "complete")
          return result.text
        }
        yield* Effect.forEach(result.toolCalls, (call) =>
          Effect.gen(function* () {
            const tool = boundNow.names.get(call.name)
            const run = tool !== undefined
              ? tool.execute(call.input)
              : Effect.fail(`unknown tool "${call.name}"`)
            const outcome = yield* Effect.either(Effect.map(run, (output) => JSON.stringify(output ?? null)))
            const content = outcome._tag === "Left"
              ? JSON.stringify({ error: outcome.left })
              : outcome.right
            yield* Ref.update(messages, (ms): ReadonlyArray<Message> =>
              [...ms, { role: "tool", id: call.id, name: call.name, content }])
          }))
        return yield* step(turnStart, n + 1)
      })

    const invokeMessage = (content: string): Effect.Effect<string, AgentError> =>
      Effect.gen(function* () {
        const turnStart = yield* Ref.modify(messages, (ms): readonly [number, ReadonlyArray<Message>] =>
          [ms.length, [...ms, { role: "user", content }]])
        return yield* step(turnStart, 0)
      })

    const invokeTool: Tool = {
      name: "invokeMessage",
      input: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
      output: { type: "string" },
      execute: (input: unknown) => invokeMessage(String((input as { message: string }).message))
    }

    const shape: AgentShape = {
      name: architecture.name,
      applyTools: rebind,
      updateSystemPrompt: (next) => Ref.set(prompt, next),
      invokeMessage,
      listTurns: Ref.get(turns),
      listMessages: Ref.get(messages),
      asConnection: {
        name: architecture.name,
        tools: [invokeTool]
      }
    }
    return shape
  })

/** The agent as a Layer - the Effect composition unit for architectures. */
export const layer = (architecture: Architecture, activation: Activation): Layer.Layer<Agent, InjectError> =>
  Layer.effect(Agent, inject(architecture, activation))
