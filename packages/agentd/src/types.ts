import type { EffectRuntimeKind } from "@effect-agent/effect-bundle"

export type MachineStatus = "online" | "offline" | "degraded"
export type AgentStatus = "online" | "offline" | "degraded"
export interface Machine {
  machineId: string
  name: string
  status: MachineStatus
  /** What it can run, in `key:value` form (§8.3): `abi:effect-1 · runtime:os`. */
  capabilities: readonly string[]
  /**
   * Isolation domains this node may carry (§8.3). An allowlist, so its default
   * is *deny*: a node that declares none carries nothing, and a placement into a
   * domain it never claimed is refused by name. The alternative — an undeclared
   * allowlist meaning "anything" — would make the field decoration for exactly
   * the nodes nobody thought about.
   */
  namespaces: readonly string[]
  /**
   * The app-count ceiling this node states (§8.3, §11-Q17). Absent means it
   * stated none, which is reported as such rather than read as unlimited: a
   * ceiling nobody chose is worse than one nobody set, so the platform refrains
   * from inventing a number and says it has none.
   */
  maxApps?: number
  reportedAt: number
}
/**
 * A machine as its own node declares it (§8.5-1) — without `reportedAt`.
 *
 * That field is when the server last *heard* from the node, so it is stamped
 * here rather than carried in: a node supplying its own "last seen" would be a
 * claim and an observation sharing one field, and the one that survives would be
 * whichever the reader happened to trust.
 */
export type DeclaredMachine = Omit<Machine, "reportedAt">
export interface AgentInstance { agentId: string; machineId: string; kind: string; version: string; status: AgentStatus }
export interface McpServerRef { serverId: string; endpoint: string; transport: "stdio" | "streamable-http"; authRef?: string }
export interface McpSet { setId: string; name: string; servers: readonly string[]; allowTools?: readonly string[]; denyTools?: readonly string[] }
export interface AgentBinding { agentId: string; setIds: readonly string[]; bundleIds: readonly string[]; revision: number }
/**
 * One code artifact a machine should run (docs/architecture-rework.md §7.6:
 * board distributes tasks, the gateway distributes tool calls, agentd
 * distributes code). A binding names it as `bundleId@version` so two versions
 * can coexist — the artifact repo already holds `board@0.13.0` and `board@1.0.0`
 * side by side, and naming a version is what makes rollback a binding change.
 */
export interface BundleRef {
  bundleId: string
  version: string
  /** `effect-N` line. On a kernel this is the line it implements toward its apps. */
  abi: string
  /** Runtimes the artifact can execute in; absent = ["os"] (compat.ts default). */
  runtimes?: readonly EffectRuntimeKind[]
  /** Defaults to "app"; a "kernel" additionally declares `bootstrapAbi` (§5). */
  kind?: "app" | "kernel"
  /** `bootstrap-N` line the kernel needs from the host. Kernel-only. */
  bootstrapAbi?: string
}
export interface AdapterPlan<Config = unknown> { agentId: string; revision: number; desired: Config; changes: readonly string[] }
export interface AgentAdapter<Config = unknown> {
  readonly kind: string
  validate(config: unknown): void
  plan(agent: AgentInstance, desired: DesiredAgentConfig, reported?: unknown): AdapterPlan<Config>
  apply(plan: AdapterPlan<Config>): Promise<Config>
}
export interface DesiredAgentConfig {
  agent: AgentInstance
  revision: number
  sets: readonly McpSet[]
  servers: readonly McpServerRef[]
  /**
   * The machine the agent runs on. An artifact adapter needs it: "can this
   * machine run this bundle" is a question about the machine, not the agent.
   */
  machine?: Machine
  /** Artifacts this agent should run (§7.6). Absent = the adapter pushes none. */
  bundles?: readonly BundleRef[]
}

/**
 * Where an app instance sits inside a node (§8.1, §8.4) — *where*, not *what*.
 *
 * It deliberately does not restate `abi` or `runtimes`: those are facts about the
 * published artifact, and letting a placement repeat them would let it contradict
 * the artifact it places. One source for "what does board@1.0.0 run on" — the
 * registry — is what keeps a node's adjudication honest.
 */
export interface NodeAppPlacement {
  readonly bundleId: string
  readonly version: string
  /** Isolation domain this instance lands in (§8.2: mesh addresses (ns, bundleId)). */
  readonly ns: string
  /** Absent = enabled. A disabled placement is declared but not served. */
  readonly enabled?: boolean
}

/**
 * A placement resolved against the registry: the artifact's own facts plus the
 * address it sits at. This is what a node is actually handed (§8.4), and it is
 * fully resolved so the receiving host applies no defaults of its own.
 */
export interface ResolvedNodeApp extends BundleRef {
  readonly ns: string
  /** Absent = enabled. */
  readonly enabled?: boolean
}

export interface NodeBinding {
  nodeId: string
  revision: number
  /** `bundleId@version` of the kernel this node runs, if one was bound. */
  kernelId?: string
  /** `ns::bundleId@version` per placement — the placement identity, not the artifact id. */
  placements: readonly string[]
}

/**
 * The deployment unit (§8.4): a node's whole expected kernel + app set, instead
 * of one artifact for one agent. Same receipt machinery as everything else in
 * agentd (`revision` + `reportApplied`'s 409) — a bigger unit is not a reason to
 * invent a second concurrency rule.
 */
export interface DesiredNode {
  readonly node: Machine
  readonly revision: number
  readonly kernel?: BundleRef
  readonly apps: readonly ResolvedNodeApp[]
}
