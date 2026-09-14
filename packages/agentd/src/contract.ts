import type {
  AdapterPlan, AgentBinding, AgentInstance, BundleRef, DeclaredMachine, DesiredAgentConfig, McpServerRef, McpSet, Machine,
} from "./types.ts"
import type { GatewayAgentConfig } from "./adapter.ts"
import type { DesiredNode, NodeAppPlacement, NodeBinding } from "./node-types.ts"
import type { NodePresence } from "./presence.ts"
import type { WireArtifact } from "./artifact-wire.ts"

export interface NodeLiveness {
  readonly tokenRequired: boolean
  readonly nodes: readonly NodePresence[]
}

export interface AgentdControl {
  registerMachine(machine: Machine): Machine
  registerAgent(agent: AgentInstance): AgentInstance
  registerServer(server: McpServerRef): McpServerRef
  upsertSet(set: McpSet): McpSet
  bindAgent(agentId: string, setIds: readonly string[]): AgentBinding
  setCredential(agentId: string, token: string): { readonly agentId: string; readonly revision: number }
  mcpsets(): { readonly revision: number; readonly sets: readonly McpSet[]; readonly bindings: readonly AgentBinding[] }
  publishBundle(bundle: BundleRef, source?: string): BundleRef
  artifact(bundleId: string, token?: string): WireArtifact
  gatewayConfig(agentId: string, token?: string, reported?: unknown): AdapterPlan<GatewayAgentConfig>
  bindBundles(agentId: string, bundleIds: readonly string[]): AgentBinding
  desired(agentId: string): DesiredAgentConfig
  reportApplied(agentId: string, revision: number, state: unknown): { agentId: string; revision: number; state: unknown }
  bindNode(nodeId: string, kernelId: string | undefined, apps: readonly NodeAppPlacement[]): NodeBinding
  desiredNode(nodeId: string): DesiredNode
  reportNodeApplied(nodeId: string, revision: number, state: unknown): { nodeId: string; revision: number; state: unknown }
  announceNode(machine: DeclaredMachine, token?: string): NodePresence
  heartbeatNode(nodeId: string, token?: string): NodePresence
  withdrawNode(nodeId: string, token?: string): NodePresence
  nodePresence(nodeId: string): NodePresence
  nodeLiveness(): NodeLiveness
  status(): unknown
}
