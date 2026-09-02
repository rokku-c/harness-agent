/**
 * ToolDescriptor: the capability surface as DATA (M2, API-as-data).
 * The same descriptor can be compiled into any implementation surface -
 * core Ops, MCP tools, a Claude Code tool set, or a test stub. `hidden`
 * trims a capability (canDo) without changing the descriptor itself.
 */
export interface ToolDescriptor {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, unknown>
  readonly access: "read" | "write"
  readonly hidden?: boolean
  readonly execute: (input: unknown) => Promise<unknown>
}

export type ToolSpec = {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, unknown>
  readonly access: "read" | "write"
  readonly execute: (input: unknown) => Promise<unknown>
}

export const tool = (spec: ToolSpec): ToolDescriptor => ({ ...spec, hidden: false })
