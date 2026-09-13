/** What agentd's operations read and write. One object, so a new surface is one field. */
import type { AgentdControl, FactsRegistry, LaunchQueue, Tunnel } from "@effect-agent/agentd"

export interface AppliedReport {
  readonly agentId: string
  readonly revision: number
  readonly state: unknown
  readonly at: number
}
/** The node-level receipt (§8.4), on the same revision rule as the agent one. */
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
