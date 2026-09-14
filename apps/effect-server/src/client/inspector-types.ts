export interface InspectorTool {
  readonly name: string
  readonly title?: string
  readonly description?: string
  readonly inputSchema: unknown
}

export interface InspectorPayload {
  readonly id: string
  readonly title: string
  readonly tools: readonly InspectorTool[]
}

export interface InspectorField {
  readonly name: string
  readonly type: "string" | "number" | "boolean" | "choice" | "json"
  readonly required: boolean
  readonly description?: string
  readonly choices?: readonly string[]
  readonly fallback?: string
}
