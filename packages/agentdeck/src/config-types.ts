import type { AgentKind } from "./kinds.ts"

export interface LaunchMcpServer {
  readonly url: string
  readonly token: string
}

export interface UnifiedAgentConfig {
  readonly kind: AgentKind
  readonly label?: string
  readonly cwd: string
  readonly model?: string
  readonly command?: string
  readonly args?: ReadonlyArray<string>
  readonly env?: ReadonlyMap<string, string>
  readonly mcp?: Readonly<Record<string, LaunchMcpServer>>
  readonly turnTimeoutMs?: number
  readonly consent?: {
    readonly autoApproveTools?: ReadonlyArray<string>
    readonly defaultDecision?: "ask" | "allow" | "deny"
  }
  readonly extra?: Readonly<Record<string, unknown>>
}
