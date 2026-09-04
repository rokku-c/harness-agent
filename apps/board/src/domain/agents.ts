export type AgentChannel = "mcp-self" | "probe" | "runtime"
export type AgentStatus = "online" | "offline" | "suspect"
export type IsolationLevel = "env" | "workspace" | "sandbox"

export interface AgentCapabilities {
  readonly launchKinds: ReadonlyArray<string>
  readonly claimKinds: ReadonlyArray<string>
  readonly isolation: ReadonlyArray<IsolationLevel>
  readonly pollIntervalMs?: number
}

export interface AgentInstance {
  readonly agentId: string
  readonly kind: string
  readonly channel: AgentChannel
  readonly host?: string
  readonly capabilities: AgentCapabilities
  readonly status: AgentStatus
  readonly lastSeen: number
}

export const supportsLaunch = (agent: AgentInstance, kind: string, isolation?: IsolationLevel): boolean =>
  agent.capabilities.launchKinds.includes(kind) && (isolation === undefined || agent.capabilities.isolation.includes(isolation))

export const isOffline = (agent: AgentInstance, now: number, factor = 3): boolean =>
  now - agent.lastSeen > (agent.capabilities.pollIntervalMs ?? 1500) * factor
