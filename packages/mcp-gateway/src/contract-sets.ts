export interface McpGatewayServer { readonly serverId: string; readonly name?: string; readonly era?: string; readonly transport?: "streamable-http" | "stdio"; readonly endpoint?: string; readonly command?: string; readonly args?: readonly string[]; readonly env?: Readonly<Record<string, string>>; readonly headers?: Readonly<Record<string, string>> }
export interface McpSet { readonly setId: string; readonly name: string; readonly servers: readonly string[]; readonly allowTools?: readonly string[]; readonly denyTools?: readonly string[] }
export interface McpSetBinding { readonly agentId: string; readonly setIds: readonly string[] }
export type McpSetRefusal = "deny" | "allowlist"
export interface McpSetReach extends McpGatewayServer { readonly setId: string }
export interface McpSetResolution extends McpSetReach {
  readonly allowed: boolean
  readonly refusedBy?: McpSetRefusal
}
export interface McpSetQuery {
  readonly agent?: string
  readonly setId?: string
  readonly serverId?: string
  readonly tool?: string
}
export interface McpSetReader {
  bound(agent: string | undefined): boolean
  resolve(query: McpSetQuery): McpSetResolution | undefined
}
export interface McpSetRegistry extends McpSetReader {
  registerServer(server: McpGatewayServer): void
  registerSet(set: McpSet): void
  bindAgent(binding: McpSetBinding): void
}
export type McpServerSource = McpGatewayServer & { readonly transport: "streamable-http" | "stdio"; readonly endpoint: string; readonly headers?: Readonly<Record<string, string>> }
