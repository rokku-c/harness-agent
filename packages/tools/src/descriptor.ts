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
