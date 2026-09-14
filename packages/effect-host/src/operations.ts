export type JsonSchema = Readonly<Record<string, unknown>>

export interface HostOperation {
  readonly name: "list" | "enable" | "disable" | "reload" | "unregister"
  readonly plane: "lifecycle"
  readonly description: string
  readonly method: "GET" | "POST" | "DELETE"
  readonly path: string
  readonly inputSchema: JsonSchema
  readonly outputSchema: JsonSchema
}

export interface HostReloadResult {
  readonly ok: boolean
  readonly reason?: string
  readonly generation?: number
  readonly error?: unknown
  readonly report?: unknown
}

export interface HostOperationTarget {
  list(): ReadonlyArray<{ readonly id: string; readonly enabled: boolean; readonly priority: number }>
  enable(id: string): Promise<boolean>
  disable(id: string): Promise<boolean>
  unregister(id: string): Promise<boolean>
  isEnabled(id: string): boolean
  reload?(id: string): Promise<HostReloadResult>
}
