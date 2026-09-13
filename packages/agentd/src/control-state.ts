/**
 * The control plane's state, and the one write counter over it.
 *
 * Every verb in `control-*.ts` is a function over this value, which is why the
 * state is a record of maps rather than a closure per method: the maps *are* the
 * state, and the revision is the single thing a receipt is measured against —
 * the same counter whether the write was an MCP set, a bundle binding or a node
 * deployment.
 *
 * Node liveness (§8.5-1) is kept apart from `machines` on purpose: `machines` is
 * what a node *is* (identity, capabilities — true whether or not it is running),
 * `presence` is whether it is *up* right now. Nothing here is ever persisted, and
 * it should not be: a config file cannot know which nodes are alive, so a
 * restored lease table would be a set of claims nobody made.
 */

import { makeBundleRegistry, type BundleRegistry } from "./bundle-registry.ts"
import { makeNodeGuard, type NodeGuard } from "./control-guard.ts"
import { AgentdError } from "./errors.ts"
import type { ResolvedNodeApp, NodeBinding } from "./node-types.ts"
import { type NodePresenceTable, type LeaseClock } from "./presence.ts"
import { makeNodePresence } from "./presence-table.ts"
import type { AgentBinding, AgentInstance, BundleRef, Machine, McpServerRef, McpSet } from "./types.ts"

export interface AgentdControlOptions {
  /** Both halves of the lease clock; injected so a test can age a node out (§8.5-1). */
  readonly clock?: Partial<LeaseClock>
  /** How long one node heartbeat is good for. Absent = `presence.ts`'s default. */
  readonly leaseTtlMs?: number
  /**
   * The token node liveness verbs must present. Absent = they accept anyone, and
   * `control-guard.ts` reports that as `tokenRequired: false` — an unarmed guard
   * that looked armed would be worse than no guard.
   */
  readonly nodeToken?: string
}

/** A node's held deployment (§8.4): the binding, plus what it resolved to. */
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
  /** Published versions and their bytes (§7.6); version identity is owned over there. */
  readonly registry: BundleRegistry
  /**
   * A node's deployment (§8.4). The binding carries only addresses, so the
   * placements themselves live beside it — parsing `ns::id@version` back apart
   * would make the namespace grammar load-bearing for no gain.
   */
  readonly nodes: Map<string, HeldNode>
  /** Derived on read, never stored: see `presence-table.ts`. */
  readonly presence: NodePresenceTable
  /** The credential every node-facing verb presents, when one is armed (§8.5-1). */
  readonly guard: NodeGuard
  revision(): number
  bump(): number
  checkId(id: string): void
}

export const makeControlState = (options: AgentdControlOptions = {}): ControlState => {
  const machines = new Map<string, Machine>(), agents = new Map<string, AgentInstance>()
  const servers = new Map<string, McpServerRef>(), sets = new Map<string, McpSet>(), bindings = new Map<string, AgentBinding>()
  const registry = makeBundleRegistry()
  const nodes = new Map<string, HeldNode>()
  let revision = 0
  const presence = makeNodePresence({
    ...(options.leaseTtlMs === undefined ? {} : { leaseTtlMs: options.leaseTtlMs }),
    ...(options.clock === undefined ? {} : { clock: options.clock }),
  })
  return {
    machines, agents, servers, sets, bindings, registry, nodes, presence,
    guard: makeNodeGuard(options.nodeToken),
    revision: () => revision,
    bump: () => ++revision,
    checkId: (id) => { if (!id || /\s/.test(id)) throw new AgentdError(400, "invalid id") },
  }
}
