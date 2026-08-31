/**
 * The layered connection abstraction.
 *
 * A Connection is the injectable unit: a named surface of tools plus the
 * notation store its prose lives in. An agent declares HOW it accepts
 * connections (the five declaration modes); the runtime matches, prefixes,
 * flattens cascades, and verifies shapes at injection time. An Agent is
 * itself a Connection - that is the layer that lets agents compose like
 * tools.
 *
 * The prose rule is absolute: a Tool carries NO description. Model-facing
 * prose resolves from the connection's notation store at bind time and
 * exists only on the BoundTool (the wire artifact). External prose (an MCP
 * server's tool descriptions) is normalized into a store by its adapter -
 * every route to the model goes through a store.
 *
 * The model is a connection too - a ModelConnection, the subtype that
 * carries the generate capability. The base Connection does not know the
 * model exists.
 */
import { Effect } from "effect"
import type { GenerateResult, Message } from "./message.ts"
import { resolveNotation, type NotationStore } from "./notation.ts"

/** JSON Schema object (the MCP-native tool schema form). */
export type JsonSchema = Record<string, unknown>

/** The authored tool: pure mechanism, zero prose. */
export interface Tool {
  readonly name: string
  readonly input: JsonSchema
  readonly output: JsonSchema
  readonly execute: (input: unknown) => Effect.Effect<unknown, unknown>
}

/**
 * The injectable unit: a named tool surface plus its prose store. Every
 * dependency an agent takes - an MCP server, a service binding, another
 * agent - is normalized to this.
 */
export interface Connection {
  readonly name: string
  readonly tools: ReadonlyArray<Tool>
  /** The store this connection's tool descriptions resolve from at bind time. */
  readonly notation?: NotationStore
}

export const connection = (name: string, tools: ReadonlyArray<Tool>, notation?: NotationStore): Connection =>
  notation === undefined ? { name, tools } : { name, tools, notation }

/**
 * The model connection: the Connection subtype that carries the generate
 * capability. The agent runtime resolves its model through this surface;
 * nothing else has (or needs) it.
 */
export interface ModelConnection extends Connection {
  readonly generate: (
    systemPrompt: string,
    messages: ReadonlyArray<Message>,
    tools: ReadonlyArray<BoundTool>
  ) => Effect.Effect<GenerateResult, unknown>
}

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
export const any = <const P extends string>(prefix?: P): { _tag: "Any"; prefix: P } =>
  ({ _tag: "Any", prefix: (prefix ?? "mcp__") as P & string })
/** Mode 2 - named: accepts only these connection names; the name is the prefix. */
export const named = <const N extends ReadonlyArray<string>>(...names: N): { _tag: "Named"; names: N } =>
  ({ _tag: "Named", names })
/** Mode 3 - shaped: accepts a connection whose tools match the shape (schemas verified). */
export const shaped = <const S extends ReadonlyArray<ShapeTool>>(shape: S): { _tag: "Shaped"; shape: S } =>
  ({ _tag: "Shaped", shape })
/** Mode 4 - named + shaped: both constraints. */
export const namedShaped = <const N extends ReadonlyArray<string>, const S extends ReadonlyArray<ShapeTool>>(
  names: N,
  shape: S
): { _tag: "NamedShaped"; names: N; shape: S } => ({ _tag: "NamedShaped", names, shape })
/** Mode 5 - cascade: accepts a connection tree; members flatten to prefixed tools. */
export const cascade = (members: ReadonlyArray<ConnectionDecl>): ConnectionDecl => ({ _tag: "Cascade", members })

// ---------------------------------------------------------------------------
// Type-level derivation: the tool names an agent's connection spec yields.
// Declarations preserve their literals via const type parameters, so this
// composes at compile time. The runtime prefix is the CONNECTION name (the
// owner's rule: "name = prefix, e.g. grafana__"), so the derivation follows:
// named slots know their candidate connection names exactly; shaped slots
// know their tool names but not which connection supplies them; any slots
// know their prefix.
// ---------------------------------------------------------------------------
export type ToolNamesOf<S extends ConnectionSpec> = {
  [K in keyof S & string]: S[K] extends { _tag: "Any"; prefix: infer P extends string }
    ? `${P}${string}`
    : S[K] extends { _tag: "Named"; names: infer N extends ReadonlyArray<string> }
      ? `${N[number]}__${string}`
      : S[K] extends { _tag: "Shaped"; shape: infer SH extends ReadonlyArray<ShapeTool> }
        ? `${string}__${SH[number]["name"]}`
        : S[K] extends { _tag: "NamedShaped"; names: infer NN extends ReadonlyArray<string>; shape: infer NSH extends ReadonlyArray<ShapeTool> }
          ? `${NN[number]}__${NSH[number]["name"]}`
          : S[K] extends { _tag: "Cascade" } ? `${string}__${string}__${string}`
          : never
}[keyof S & string]

// ---------------------------------------------------------------------------
// Injection: match a connection against a declaration, producing the agent's
// effective tool list (prefixed, prose resolved) or throwing a precise error.
// ---------------------------------------------------------------------------

export interface BoundTool extends Tool {
  /** The tool name as the model sees it, e.g. "grafana__list_dashboards". */
  readonly boundName: string
  /** The connection it came from. */
  readonly source: string
  /** The model-facing prose, resolved from the connection's store at bind time. */
  readonly description: string
}

const describeTool = (conn: Connection, tool: Tool): string => {
  if (conn.notation === undefined)
    throw new Error(`connection "${conn.name}": tool "${tool.name}" has no notation store - model-facing prose must live in a store`)
  const entry = conn.notation.get(`tool:${tool.name}`)
  if (entry === undefined || (entry.instructions ?? []).length === 0)
    throw new Error(`connection "${conn.name}": no notation entry for tool "${tool.name}" - model-facing prose must live in a store`)
  return resolveNotation(conn.notation, `tool:${tool.name}`)
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

/** Flatten a cascade tree (recursively): member connections become prefixed tools. */
export const flattenCascade = (conn: Connection & { members?: ReadonlyArray<Connection> }, prefix: string): BoundTool[] => {
  const members = (conn as { members?: ReadonlyArray<Connection> }).members
  if (members === undefined) throw new Error(`cascade connection "${conn.name}" exposes no members`)
  const bound: BoundTool[] = []
  for (const member of members) {
    // a nested cascade deepens the prefix - the tree flattens fully
    if ((member as { members?: ReadonlyArray<Connection> }).members !== undefined) {
      bound.push(...flattenCascade(member as Connection & { members?: ReadonlyArray<Connection> }, `${prefix}${member.name}__`))
      continue
    }
    for (const tool of member.tools)
      bound.push({
        ...tool,
        boundName: `${prefix}${member.name}__${tool.name}`,
        source: `${conn.name}/${member.name}`,
        description: describeTool(member, tool)
      })
  }
  return bound
}

/**
 * Bind one connection to one declaration: returns the tools the agent gains,
 * namespaced with their prose resolved. Throws on name/shape/prose mismatch
 * - a wiring bug fails loud.
 */
export const bind = (decl: ConnectionDecl, conn: Connection): BoundTool[] => {
  const bindTool = (tool: Tool, boundName: string, source: string): BoundTool =>
    ({ ...tool, boundName, source, description: describeTool(conn, tool) })
  switch (decl._tag) {
    case "Any":
      return conn.tools.map((tool) => bindTool(tool, `${decl.prefix}${tool.name}`, conn.name))
    case "Named":
      if (!decl.names.includes(conn.name))
        throw new Error(`connection "${conn.name}" is not accepted here (expects ${decl.names.join(", ")})`)
      return conn.tools.map((tool) => bindTool(tool, `${conn.name}__${tool.name}`, conn.name))
    case "Shaped":
      shapeMatches(decl.shape, conn.tools)
      return conn.tools.map((tool) => bindTool(tool, `${conn.name}__${tool.name}`, conn.name))
    case "NamedShaped":
      if (!decl.names.includes(conn.name))
        throw new Error(`connection "${conn.name}" is not accepted here (expects ${decl.names.join(", ")})`)
      shapeMatches(decl.shape, conn.tools)
      return conn.tools.map((tool) => bindTool(tool, `${conn.name}__${tool.name}`, conn.name))
    case "Cascade":
      return flattenCascade(conn as Connection & { members?: ReadonlyArray<Connection> }, `${conn.name}__`)
  }
}
