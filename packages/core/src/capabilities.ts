/** What a driver can and cannot do - the contract agents are checked against. */
export type Granularity = "event" | "turn" | "run"
export type ToolInjection = "native" | "mcp" | "none"
export type StructuredOutput = "native" | "tool" | "text" | "none"

export interface Capabilities {
  readonly provider:
    | { readonly _tag: "Configurable" }
    | { readonly _tag: "Fixed"; readonly api: string }
  readonly granularity: Granularity
  readonly thinking: boolean
  readonly cancel: boolean
  readonly pause: boolean
  readonly resume: boolean
  readonly fork: "node" | "session" | "none"
  readonly tools: ToolInjection
  readonly toolCalls: "intercept" | "observe" | "none"
  readonly structuredOutput: StructuredOutput
  readonly sandbox: "enforced" | "delegated" | "none"
}

