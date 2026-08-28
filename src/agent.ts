/**
 * The agent abstraction.
 *
 * An agent is defined in this order: first its dependent CONNECTIONS (the six
 * declaration modes), then its SHAPE (prompt, loop bound). Agents depend on
 * agents through the same mechanism, because an Agent is itself a Connection -
 * its model-facing surface is invokeMessage (plus the log inspectors). The
 * base agent is the LLM: we never define a model, we adapt one in via the Llm
 * port (dsh-style: the message log is the truth, turns are its slices).
 */
import type { Connection, ConnectionDecl, ConnectionSpec, Tool } from "./connection.ts"
import { bind } from "./connection.ts"
import { resolveNotation, type NotationStore, type NotationText } from "./notation.ts"

// ---------------------------------------------------------------------------
// Messages and turns - the session log.
// ---------------------------------------------------------------------------
export type Message =
  | { readonly role: "user"; readonly content: string }
  | { readonly role: "assistant"; readonly content: string }
  | { readonly role: "tool"; readonly name: string; readonly content: string }

export interface Turn {
  readonly index: number
  readonly messages: ReadonlyArray<Message>
  readonly status: "complete" | "max-steps"
}

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
  generate(systemPrompt: string, messages: ReadonlyArray<Message>, tools: ReadonlyArray<Tool>): Promise<LlmResult>
}

// ---------------------------------------------------------------------------
// The base agent shape - every agent carries it (or a customization). The
// owner-facing controls (applyTools/updateSystemPrompt) are programmatic; the
// model-facing surface of an agent-as-connection is invokeMessage.
// ---------------------------------------------------------------------------
export interface AgentShape {
  /** Apply tools: bind connections now - and re-bind any time (real-time). */
  applyTools(connections: ReadonlyArray<Connection>): void
  /** Update the system prompt (notation-injected text). */
  updateSystemPrompt(prompt: NotationText): void
  /** Invoke: append a user message and run the loop to an assistant reply. */
  invokeMessage(content: string): Promise<string>
  /** The turn log. */
  listTurns(): ReadonlyArray<Turn>
  /** The flat message log. */
  listMessages(): ReadonlyArray<Message>
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

  const runLoop = async (): Promise<string> => {
    const turnStart = messages.length
    let steps = 0
    for (;;) {
      if (steps++ >= maxSteps) {
        turns.push({ index: turns.length, messages: [...messages.slice(turnStart)], status: "max-steps" })
        throw new Error(`agent "${def.name}" exceeded maxSteps (${maxSteps})`)
      }
      const result = await llm.generate(systemPrompt, messages, bound.tools)
      if (result.toolCalls.length > 0) {
        messages.push({ role: "assistant", content: result.text })
        for (const call of result.toolCalls) {
          const tool = bound.names.get(call.name)
          if (tool === undefined) {
            messages.push({ role: "tool", name: call.name, content: JSON.stringify({ error: `unknown tool "${call.name}"` }) })
            continue
          }
          const output = await tool.execute(call.input)
          messages.push({ role: "tool", name: call.name, content: JSON.stringify(output ?? null) })
        }
        continue
      }
      messages.push({ role: "assistant", content: result.text })
      turns.push({ index: turns.length, messages: [...messages.slice(turnStart)], status: "complete" })
      return result.text
    }
  }

  // agent-as-connection: the model-facing surface a parent binds (mode 4/5
  // consumers shape it); listTurns/listMessages stay programmatic inspection
  const agent: Agent = {
    name: def.name,
    applyTools: rebind,
    updateSystemPrompt: (prompt) => { systemPrompt = prompt },
    invokeMessage: async (content) => {
      messages.push({ role: "user", content })
      return runLoop()
    },
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
