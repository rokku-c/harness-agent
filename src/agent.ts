/**
 * The agent abstraction - Effect-native.
 *
 * An agent is defined in this order: first its dependent CONNECTIONS (the six
 * declaration modes), then its SHAPE (prompt, loop bound). Agents depend on
 * agents through the same mechanism, because an Agent is itself a Connection -
 * its model-facing surface is invokeMessage (plus the log inspectors). The
 * base agent is the LLM: we never define a model, we adapt one in via the Llm
 * port. The session log is the truth; turns are its slices.
 *
 * Effect is the composition substrate: a dependent agent's invokeMessage is an
 * Effect, so parent agents compose child agents (and their R channels) without
 * glue - the connection surface and the program surface are one.
 */
import { Effect } from "effect"
import type { Connection, ConnectionDecl, ConnectionSpec, Tool } from "./connection.ts"
import { bind } from "./connection.ts"
import { resolveNotation, type NotationStore, type NotationText } from "./notation.ts"

// ---------------------------------------------------------------------------
// Messages and turns - the session log.
// ---------------------------------------------------------------------------
export type Message =
  | { readonly role: "user"; readonly content: string }
  | { readonly role: "assistant"; readonly content: string }
  /** The tool result correlates to its call by id (real protocols require it). */
  | { readonly role: "tool"; readonly id: string; readonly name: string; readonly content: string }

export interface Turn {
  readonly index: number
  readonly messages: ReadonlyArray<Message>
  readonly status: "complete" | "max-steps"
}

/** A failed run: the loop bound was hit, or the model call failed. */
export type AgentError =
  | { readonly _tag: "MaxStepsExceeded"; readonly agent: string; readonly steps: number }
  | { readonly _tag: "LlmFailed"; readonly agent: string; readonly cause: unknown }

// ---------------------------------------------------------------------------
// The Llm port: we do not define the model. A runtime adapts into this.
// ---------------------------------------------------------------------------
export interface LlmToolCall {
  readonly id: string
  readonly name: string
  readonly input: unknown
}

export interface LlmResult {
  readonly text: string
  readonly toolCalls: ReadonlyArray<LlmToolCall>
}

export interface Llm {
  /** One model call: the system prompt, the full message log, the tool surface. */
  readonly generate: (
    systemPrompt: string,
    messages: ReadonlyArray<Message>,
    tools: ReadonlyArray<Tool>
  ) => Effect.Effect<LlmResult, unknown>
}

// ---------------------------------------------------------------------------
// The base agent shape - every agent carries it (or a customization). The
// owner-facing controls (applyTools/updateSystemPrompt) are programmatic; the
// model-facing surface of an agent-as-connection is invokeMessage.
// ---------------------------------------------------------------------------
export interface AgentShape {
  /** Apply tools: bind connections now - and re-bind any time (real-time). */
  readonly applyTools: (connections: ReadonlyArray<Connection>) => void
  /** Update the system prompt (notation-injected text). */
  readonly updateSystemPrompt: (prompt: NotationText) => void
  /** Invoke: append a user message and run the loop to an assistant reply. */
  readonly invokeMessage: (content: string) => Effect.Effect<string, AgentError>
  /** The turn log. */
  readonly listTurns: () => ReadonlyArray<Turn>
  /** The flat message log. */
  readonly listMessages: () => ReadonlyArray<Message>
}

export interface Agent extends AgentShape {
  readonly name: string
  /** The agent as a connection: the surface a parent agent binds. */
  readonly asConnection: Connection
}

// ---------------------------------------------------------------------------
// The definition: connections declared first, then the shape.
// ---------------------------------------------------------------------------
export interface AgentDef {
  /** The agent's name - its identity as a connection. */
  readonly name: string
  /** Declared FIRST: how this agent accepts connections (the six modes). */
  readonly connections: ConnectionSpec
  /** Agent dependencies: an agent uses other agents to build itself up. */
  readonly agents?: ReadonlyArray<Agent>
  /** The system prompt: notation store + target (+ interpolation vars). */
  readonly prompt: { readonly store: NotationStore; readonly target: string; readonly vars?: Record<string, unknown> }
  /** Loop bound: fail after this many model steps in one invocation. */
  readonly maxSteps?: number
}

const declNames = (decl: ConnectionDecl): string[] =>
  decl._tag === "Named" || decl._tag === "NamedShaped" ? [...decl.names] : []

type BoundTools = { tools: ReadonlyArray<Tool>; names: Map<string, Tool> }

/** Build an agent: adapt an Llm (the base) into the base shape, then wire connections. */
export const defineAgent = (def: AgentDef, llm: Llm): Agent => {
  const messages: Message[] = []
  const turns: Turn[] = []
  const maxSteps = def.maxSteps ?? 8
  let systemPrompt: NotationText = resolveNotation(def.prompt.store, def.prompt.target, def.prompt.vars)

  // agent dependencies are static composition: bound at definition time.
  // Connections are runtime injection: bound (and re-bindable) via applyTools.
  const agentTools = (): { tools: Tool[]; names: Map<string, Tool> } => {
    const names = new Map<string, Tool>()
    const tools: Tool[] = []
    for (const dep of def.agents ?? []) {
      const toolName = `${dep.name}__invokeMessage`
      const tool: Tool = {
        name: toolName,
        input: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
        output: { type: "string" },
        execute: (input: unknown) => dep.invokeMessage(String((input as { message: string }).message))
      }
      names.set(toolName, tool)
      tools.push(tool)
    }
    return { tools, names }
  }
  let agentBound = agentTools()
  let bound: BoundTools = agentBound

  const rebind = (connections: ReadonlyArray<Connection>): void => {
    const specs = Object.entries(def.connections)
    const tools: Tool[] = []
    const names = new Map<string, Tool>()
    const claimed = new Set<string>()
    // two passes: specific slots (keyed / named / shaped / cascade) match
    // first; any-mode slots take the leftovers - so an any slot cannot steal
    // a connection a specific slot needs.
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
        throw new Error(`agent "${def.name}": connection "${key}" was not provided`)
      claimed.add(conn.name)
      for (const boundTool of bind(decl, conn)) {
        names.set(boundTool.boundName, boundTool)
        tools.push(boundTool)
      }
    }
    agentBound = agentTools()
    bound = { tools: [...tools, ...agentBound.tools], names: new Map([...names, ...agentBound.names]) }
  }

  // one model step: call the model, run its tool calls into the log, or land
  // the assistant reply and close the turn. A tool failure is fed back to the
  // model as a tool result (the retry path), never silently swallowed.
  const step = (turnStart: number, n: number): Effect.Effect<string, AgentError> => {
    if (n >= maxSteps) {
      const turn: Turn = { index: turns.length, messages: [...messages.slice(turnStart)], status: "max-steps" }
      return Effect.sync(() => turns.push(turn)).pipe(
        Effect.andThen(Effect.fail<AgentError>({ _tag: "MaxStepsExceeded", agent: def.name, steps: maxSteps }))
      )
    }
    return llm.generate(systemPrompt, messages, bound.tools).pipe(
      Effect.catchAll((cause) => Effect.fail<AgentError>({ _tag: "LlmFailed", agent: def.name, cause })),
      Effect.flatMap((result) => {
        if (result.toolCalls.length === 0) {
          messages.push({ role: "assistant", content: result.text })
          turns.push({ index: turns.length, messages: [...messages.slice(turnStart)], status: "complete" })
          return Effect.succeed(result.text)
        }
        messages.push({ role: "assistant", content: result.text })
        return Effect.forEach(result.toolCalls, (call) => {
          const tool = bound.names.get(call.name)
          const run = tool !== undefined
            ? tool.execute(call.input)
            : Effect.fail(`unknown tool "${call.name}"`)
          return run.pipe(
            Effect.map((output) => messages.push({ role: "tool", id: call.id, name: call.name, content: JSON.stringify(output ?? null) })),
            Effect.catchAll((cause) =>
              Effect.sync(() => messages.push({ role: "tool", id: call.id, name: call.name, content: JSON.stringify({ error: cause }) }))
            )
          )
        }).pipe(Effect.andThen(step(turnStart, n + 1)))
      })
    )
  }

  const agent: Agent = {
    name: def.name,
    applyTools: rebind,
    updateSystemPrompt: (prompt) => { systemPrompt = prompt },
    invokeMessage: (content) =>
      Effect.sync(() => messages.push({ role: "user", content })).pipe(Effect.andThen(step(messages.length - 1, 0))),
    listTurns: () => turns,
    listMessages: () => messages,
    asConnection: {
      name: def.name,
      tools: [
        {
          name: "invokeMessage",
          input: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
          output: { type: "string" },
          execute: (input: unknown) => agent.invokeMessage(String((input as { message: string }).message))
        }
      ]
    }
  }
  return agent
}
