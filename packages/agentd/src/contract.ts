import type { AgentBinding, AgentInstance, DesiredAgentConfig, McpServerRef, McpSet, Machine } from "./types.ts"
export interface AgentdControl {
  registerMachine(machine: Machine): Machine
  registerAgent(agent: AgentInstance): AgentInstance
  registerServer(server: McpServerRef): McpServerRef
  upsertSet(set: McpSet): McpSet
  bindAgent(agentId: string, setIds: readonly string[]): AgentBinding
  desired(agentId: string): DesiredAgentConfig
  reportApplied(agentId: string, revision: number, state: unknown): { agentId: string; revision: number; state: unknown }
  status(): unknown
}
