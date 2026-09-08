export type MachineStatus = "online" | "offline" | "degraded"
export type AgentStatus = "online" | "offline" | "degraded"
export interface Machine { machineId: string; name: string; status: MachineStatus; capabilities: readonly string[]; reportedAt: number }
export interface AgentInstance { agentId: string; machineId: string; kind: string; version: string; status: AgentStatus }
export interface McpServerRef { serverId: string; endpoint: string; transport: "stdio" | "streamable-http"; authRef?: string }
export interface McpSet { setId: string; name: string; servers: readonly string[]; allowTools?: readonly string[]; denyTools?: readonly string[] }
export interface AgentBinding { agentId: string; setIds: readonly string[]; revision: number }
export interface AdapterPlan<Config = unknown> { agentId: string; revision: number; desired: Config; changes: readonly string[] }
export interface AgentAdapter<Config = unknown> {
  readonly kind: string
  validate(config: unknown): void
  plan(agent: AgentInstance, desired: DesiredAgentConfig, reported?: unknown): AdapterPlan<Config>
  apply(plan: AdapterPlan<Config>): Promise<Config>
}
export interface DesiredAgentConfig { agent: AgentInstance; revision: number; sets: readonly McpSet[]; servers: readonly McpServerRef[] }
