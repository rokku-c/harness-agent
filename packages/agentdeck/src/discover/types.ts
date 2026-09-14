import type { AgentKind } from "../kinds.ts"

export interface DiscoveredSession {
  readonly kind: AgentKind
  readonly sessionId: string
  readonly cwd?: string
  readonly title?: string
  readonly startedAt: number
  readonly updatedAt: number
  readonly bytes: number
  readonly source: string
  readonly tail?: string
}

export interface DiscoverOptions {
  readonly home?: string
  readonly limit?: number
  readonly kinds?: ReadonlyArray<AgentKind>
}

export interface SessionSource {
  readonly kind: AgentKind
  readonly discover: (home: string, limit: number) => Promise<ReadonlyArray<DiscoveredSession>>
}
