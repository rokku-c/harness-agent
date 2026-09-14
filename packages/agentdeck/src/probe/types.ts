import type { AgentKind } from "../kinds.ts"

export type { AgentKind }

export type CredentialState = "configured" | "missing" | "unknown"

export interface ProviderFacts {
  readonly provider?: string
  readonly model?: string
  readonly baseUrlHost?: string
  readonly credential: CredentialState
}

export interface McpServerFacts {
  readonly name: string
  readonly transport: "stdio" | "http" | "sse" | "unknown"
  readonly target?: string
  readonly scope: "global" | "project"
}

export interface PermissionFacts {
  readonly approval?: string
  readonly allow?: ReadonlyArray<string>
  readonly deny?: ReadonlyArray<string>
  readonly sandbox?: string
}

export interface AgentFacts {
  readonly kind: AgentKind
  readonly installed: boolean
  readonly path?: string
  readonly version?: string
  readonly provider?: ProviderFacts
  readonly mcpServers: ReadonlyArray<McpServerFacts>
  readonly permissions?: PermissionFacts
  readonly sources: ReadonlyArray<string>
  readonly notes?: ReadonlyArray<string>
}

export interface MachineFacts {
  readonly home: string
  readonly at: number
  readonly agents: ReadonlyArray<AgentFacts>
}

export interface ProbeOptions {
  readonly home?: string
  readonly cwd?: string
  readonly kinds?: ReadonlyArray<AgentKind>
  readonly skipVersion?: boolean
}
