/**
 * What the inspector receives, declared here rather than imported from the
 * server's copy: the browser bundle must not reach into console/tools-route.ts,
 * which pulls the registry and zod in with it. The two shapes meet at one HTTP
 * response — the route's `{ kind: "tools", … }` — and this is that response.
 */

export interface InspectorTool {
  readonly name: string
  readonly title?: string
  readonly description?: string
  /** The tool's JSON Schema, as the MCP door serves it. */
  readonly inputSchema: unknown
}

export interface InspectorPayload {
  readonly id: string
  readonly title: string
  readonly tools: readonly InspectorTool[]
}

/** One argument the form can render, read out of the tool's input schema. */
export interface InspectorField {
  readonly name: string
  readonly type: "string" | "number" | "boolean" | "choice" | "json"
  /** True only when the call fails without it — a field with a default is not. */
  readonly required: boolean
  readonly description?: string
  /** For `choice`: the values the schema permits. */
  readonly choices?: readonly string[]
  /** What the tool applies when the field is left empty, as the schema wrote it. */
  readonly fallback?: string
}
