import type {
  AgentBinding, AgentInstance, BundleRef, DeclaredMachine, DesiredAgentConfig, DesiredNode, McpServerRef, McpSet, Machine,
  NodeAppPlacement, NodeBinding,
} from "./types.ts"
import type { NodePresence } from "./presence.ts"
import type { WireArtifact } from "./artifact-wire.ts"

/**
 * What the server believes about who is up (§8.5-1), and whether the verbs that
 * *change* that belief are guarded.
 *
 * `tokenRequired` is here rather than left implicit because an unarmed guard and
 * an armed one look identical from outside — one 401 away from each other — and
 * the operator should not have to read the config to find out which they have.
 */
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
  /**
   * Publish one artifact version for distribution (§7.6); keyed `bundleId@version`.
   * `source` is the directory its bytes live in, when the publisher has them —
   * a version published without one is a version a node must already have.
   */
  publishBundle(bundle: BundleRef, source?: string): BundleRef
  /**
   * A published version's bytes, as they cross the wire (§8.2, P6). `token` is
   * the node credential, checked here rather than at the route so one guard
   * covers every node-facing verb.
   */
  artifact(bundleId: string, token?: string): WireArtifact
  /** Bind artifacts to an agent; bumps the same revision the receipt is measured against. */
  bindBundles(agentId: string, bundleIds: readonly string[]): AgentBinding
  desired(agentId: string): DesiredAgentConfig
  reportApplied(agentId: string, revision: number, state: unknown): { agentId: string; revision: number; state: unknown }
  /**
   * Bind a whole node's deployment (§8.4): one kernel plus app placements at
   * namespaces. Same revision counter and receipt as the agent-level bindings,
   * because a bigger unit is not a second concurrency rule.
   */
  bindNode(nodeId: string, kernelId: string | undefined, apps: readonly NodeAppPlacement[]): NodeBinding
  desiredNode(nodeId: string): DesiredNode
  reportNodeApplied(nodeId: string, revision: number, state: unknown): { nodeId: string; revision: number; state: unknown }
  /**
   * Node liveness (§8.5-1). Registering a machine is a declaration — it says
   * what a node *is*, and stays true whether or not the node is running. These
   * four are the node's own signs of life, which is the only thing that makes
   * `online` true.
   */
  announceNode(machine: DeclaredMachine, token?: string): NodePresence
  heartbeatNode(nodeId: string, token?: string): NodePresence
  withdrawNode(nodeId: string, token?: string): NodePresence
  nodePresence(nodeId: string): NodePresence
  nodeLiveness(): NodeLiveness
  status(): unknown
}
