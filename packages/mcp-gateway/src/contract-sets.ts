/**
 * mcp-gateway — what can be reached, and by whom.
 *
 * A server is a thing that exists; a set is a named group of them with two
 * optional lists; a binding says which identity reaches which sets. Those three
 * declarations are the whole routing question, and the registry is the one place
 * they are answered — every decision the gateway makes about *where* a call goes
 * comes out of `resolve`, so the console's preview and the door's proxy cannot
 * disagree about which server a call would use.
 *
 * Nothing here knows what a call is. A query is a question about the topology,
 * asked with or without a tool — without one it is the routing question alone,
 * which no list can refuse.
 */
export interface McpGatewayServer { readonly serverId: string; readonly name?: string; readonly era?: string; readonly transport?: "streamable-http" | "stdio"; readonly endpoint?: string; readonly command?: string; readonly args?: readonly string[]; readonly env?: Readonly<Record<string, string>>; readonly headers?: Readonly<Record<string, string>> }
export interface McpSet { readonly setId: string; readonly name: string; readonly servers: readonly string[]; readonly allowTools?: readonly string[]; readonly denyTools?: readonly string[] }
export interface McpSetBinding { readonly agentId: string; readonly setIds: readonly string[] }
/** Which of a set's two lists refused a tool. A list's absence is not a refusal. */
export type McpSetRefusal = "deny" | "allowlist"
/** The bound set the gateway would use: the first that reaches a server. */
export interface McpSetReach extends McpGatewayServer { readonly setId: string }
export interface McpSetResolution extends McpSetReach {
  readonly allowed: boolean
  /** Why the set refused the tool; absent exactly when `allowed`. */
  readonly refusedBy?: McpSetRefusal
}
/**
 * What a call would go through. `serverId` is the server the caller named, when
 * it named one — the advertised surface always does, so the question the door
 * answers for a call is the question it answered when it advertised the tool.
 */
export interface McpSetQuery {
  /** The identity a binding is keyed by: the verified principal key, e.g. `app:builder-2`. */
  readonly agent?: string
  readonly setId?: string
  readonly serverId?: string
  /** The tool being called. Absent asks the routing question alone, which no list can refuse. */
  readonly tool?: string
}
/**
 * The two questions anyone asks a set registry, and the only two the door asks.
 * A reader is what a caller with no business declaring sets holds — which is
 * every surface that decides, previews or draws one.
 */
export interface McpSetReader {
  /** Whether the agent has any binding at all — the question a refusal must ask to name a reason. */
  bound(agent: string | undefined): boolean
  /** The set and server a call would go through, and whether that set's lists admit the tool. */
  resolve(query: McpSetQuery): McpSetResolution | undefined
}
export interface McpSetRegistry extends McpSetReader {
  registerServer(server: McpGatewayServer): void
  registerSet(set: McpSet): void
  bindAgent(binding: McpSetBinding): void
}
/** A transport that already knows where a named server lives. */
export type McpServerSource = McpGatewayServer & { readonly transport: "streamable-http" | "stdio"; readonly endpoint: string; readonly headers?: Readonly<Record<string, string>> }
