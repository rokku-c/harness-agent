import type { AgentdControl, FactsRegistry, LaunchQueue, Tunnel } from "@effect-agent/agentd"

export interface AppliedReport {
  readonly agentId: string
  readonly revision: number
  readonly state: unknown
  readonly at: number
}
export interface NodeAppliedReport {
  readonly nodeId: string
  readonly revision: number
  readonly state: unknown
  readonly at: number
}

export interface AgentdSurfaces {
  readonly control: AgentdControl
  readonly applied: Map<string, AppliedReport>
  readonly nodeApplied: Map<string, NodeAppliedReport>
  readonly launches: LaunchQueue
  readonly tunnel: Tunnel
  readonly facts: FactsRegistry
  readonly status: () => unknown
}
