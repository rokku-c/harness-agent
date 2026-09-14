import { makeBundleRegistry, type BundleRegistry } from "./bundle-registry.ts"
import { makeNodeGuard, type NodeGuard } from "./control-guard.ts"
import { AgentdError } from "./errors.ts"
import type { ResolvedNodeApp, NodeBinding } from "./node-types.ts"
import { type NodePresenceTable, type LeaseClock } from "./presence.ts"
import { makeNodePresence } from "./presence-table.ts"
import type { AgentBinding, AgentInstance, BundleRef, Machine, McpServerRef, McpSet } from "./types.ts"

export interface AgentdControlOptions {
  readonly clock?: Partial<LeaseClock>
  readonly leaseTtlMs?: number
  readonly nodeToken?: string
  readonly gatewayUrl?: string
}

export interface HeldNode {
  readonly binding: NodeBinding
  readonly kernel?: BundleRef
  readonly apps: readonly ResolvedNodeApp[]
}

export interface ControlState {
  readonly machines: Map<string, Machine>
  readonly agents: Map<string, AgentInstance>
  readonly servers: Map<string, McpServerRef>
  readonly sets: Map<string, McpSet>
  readonly bindings: Map<string, AgentBinding>
  readonly credentials: Map<string, string>
  readonly registry: BundleRegistry
  readonly nodes: Map<string, HeldNode>
  readonly presence: NodePresenceTable
  readonly guard: NodeGuard
  revision(): number
  bump(): number
  checkId(id: string): void
}

export const makeControlState = (options: AgentdControlOptions = {}): ControlState => {
  const machines = new Map<string, Machine>(), agents = new Map<string, AgentInstance>()
  const servers = new Map<string, McpServerRef>(), sets = new Map<string, McpSet>(), bindings = new Map<string, AgentBinding>()
  const credentials = new Map<string, string>()
  const registry = makeBundleRegistry()
  const nodes = new Map<string, HeldNode>()
  let revision = 0
  const presence = makeNodePresence({
    ...(options.leaseTtlMs === undefined ? {} : { leaseTtlMs: options.leaseTtlMs }),
    ...(options.clock === undefined ? {} : { clock: options.clock }),
  })
  return {
    machines, agents, servers, sets, bindings, credentials, registry, nodes, presence,
    guard: makeNodeGuard(options.nodeToken),
    revision: () => revision,
    bump: () => ++revision,
    checkId: (id) => { if (!id || /\s/.test(id)) throw new AgentdError(400, "invalid id") },
  }
}
