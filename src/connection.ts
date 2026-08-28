/**
 * The layered connection abstraction.
 *
 * A Connection is the injectable unit: a named surface of tools plus optional
 * notation. An agent declares HOW it accepts connections (the six declaration
 * modes); the runtime matches, prefixes, flattens cascades, and verifies
 * shapes at injection time. An Agent is itself a Connection (see agent.ts) -
 * that is the layer that lets agents compose like tools.
 */
import type { NotationStore } from "./notation.ts"

/** JSON Schema object (the MCP-native tool schema form). */
export type JsonSchema = Record<string, unknown>

export interface Tool {
  readonly name: string
  readonly input: JsonSchema
  readonly output: JsonSchema
  readonly execute: (input: unknown) => Promise<unknown>
}

/**
 * The injectable unit: a named tool surface. Every dependency an agent takes -
 * an MCP server, a service binding, another agent - is normalized to this.
 */
export interface Connection {
  readonly name: string
  readonly tools: ReadonlyArray<Tool>
  /** Notated connections carry their own notation store (mode 6). */
  readonly notation?: NotationStore
}

export const connection = (name: string, tools: ReadonlyArray<Tool>, notation?: NotationStore): Connection =>
  notation === undefined ? { name, tools } : { name, tools, notation }

// ---------------------------------------------------------------------------
// Declaration modes - what an agent accepts, declared before its shape.
// ---------------------------------------------------------------------------

export type ConnectionDecl =
  | { readonly _tag: "Any"; readonly prefix: string }
  | { readonly _tag: "Named"; readonly names: ReadonlyArray<string> }
  | { readonly _tag: "Shaped"; readonly shape: ReadonlyArray<ShapeTool> }
  | { readonly _tag: "NamedShaped"; readonly names: ReadonlyArray<string>; readonly shape: ReadonlyArray<ShapeTool> }
  | { readonly _tag: "Cascade"; readonly members: ReadonlyArray<ConnectionDecl> }

/** A shaped declaration describes the tools a connection must expose. */
export interface ShapeTool {
  readonly name: string
  readonly input: JsonSchema
  readonly output: JsonSchema
}

export type ConnectionSpec = Record<string, ConnectionDecl>

/** Mode 1 - any: accepts any injected connection under a fixed prefix (MCP-like). */
export const any = (prefix = "mcp__"): ConnectionDecl => ({ _tag: "Any", prefix })
/** Mode 2 - named: accepts only these connection names; the name is the prefix. */
export const named = (...names: string[]): ConnectionDecl => ({ _tag: "Named", names })
/** Mode 4 - shaped: accepts a connection whose tools match the shape (schemas verified). */
export const shaped = (shape: ReadonlyArray<ShapeTool>): ConnectionDecl => ({ _tag: "Shaped", shape })
/** Mode 5 - named + shaped: both constraints. */
export const namedShaped = (names: string[], shape: ReadonlyArray<ShapeTool>): ConnectionDecl =>
  ({ _tag: "NamedShaped", names, shape })
/** Mode 3 - cascade: accepts a connection tree; members flatten to prefixed tools. */
export const cascade = (members: ReadonlyArray<ConnectionDecl>): ConnectionDecl => ({ _tag: "Cascade", members })

// ---------------------------------------------------------------------------
// Injection: match a connection against a declaration, producing the agent's
// effective tool list (prefixed) or throwing a precise error.
// ---------------------------------------------------------------------------

export interface BoundTool extends Tool {
  /** The tool name as the model sees it, e.g. "grafana__list_dashboards". */
  readonly boundName: string
  /** The connection it came from. */
  readonly source: string
}

const shapeMatches = (shape: ReadonlyArray<ShapeTool>, tools: ReadonlyArray<Tool>): void => {
  for (const expect of shape) {
    const found = tools.find((tool) => tool.name === expect.name)
    if (found === undefined)
      throw new Error(`shaped connection is missing tool "${expect.name}"`)
    if (JSON.stringify(found.input) !== JSON.stringify(expect.input))
      throw new Error(`tool "${expect.name}" input schema does not match the declared shape`)
    if (JSON.stringify(found.output) !== JSON.stringify(expect.output))
      throw new Error(`tool "${expect.name}" output schema does not match the declared shape`)
  }
}

/** Flatten a cascade tree: member connections become prefixed tools. */
export const flattenCascade = (conn: Connection & { members?: ReadonlyArray<Connection> }, prefix: string): BoundTool[] => {
  const members = (conn as { members?: ReadonlyArray<Connection> }).members
  if (members === undefined) throw new Error(`cascade connection "${conn.name}" exposes no members`)
  const bound: BoundTool[] = []
  for (const member of members)
    for (const tool of member.tools)
      bound.push({ ...tool, boundName: `${prefix}${member.name}__${tool.name}`, source: `${conn.name}/${member.name}` })
  return bound
}

/**
 * Bind one connection to one declaration: returns the tools the agent gains,
 * namespaced. Throws on name/shape mismatch - a wiring bug fails loud.
 */
export const bind = (decl: ConnectionDecl, conn: Connection): BoundTool[] => {
  switch (decl._tag) {
    case "Any":
      return conn.tools.map((tool) => ({ ...tool, boundName: `${decl.prefix}${tool.name}`, source: conn.name }))
    case "Named":
      if (!decl.names.includes(conn.name))
        throw new Error(`connection "${conn.name}" is not accepted here (expects ${decl.names.join(", ")})`)
      return conn.tools.map((tool) => ({ ...tool, boundName: `${conn.name}__${tool.name}`, source: conn.name }))
    case "Shaped":
      shapeMatches(decl.shape, conn.tools)
      return conn.tools.map((tool) => ({ ...tool, boundName: `${conn.name}__${tool.name}`, source: conn.name }))
    case "NamedShaped":
      if (!decl.names.includes(conn.name))
        throw new Error(`connection "${conn.name}" is not accepted here (expects ${decl.names.join(", ")})`)
      shapeMatches(decl.shape, conn.tools)
      return conn.tools.map((tool) => ({ ...tool, boundName: `${conn.name}__${tool.name}`, source: conn.name }))
    case "Cascade":
      return flattenCascade(conn as Connection & { members?: ReadonlyArray<Connection> }, `${conn.name}__`)
  }
}
