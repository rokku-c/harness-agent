/**
 * The node-level deployment model (§8.1, §8.4) — *where* app instances sit, as
 * opposed to *what* they are.
 *
 * Split out of `types.ts` because it is a second layer, not a second shape: the
 * machine/agent records there say what exists and what an agent is bound to;
 * these say how an artifact is *placed* on a node. A placement deliberately does
 * not restate `abi` or `runtimes` — those are facts about the published
 * artifact, and letting a placement repeat them would let it contradict the
 * artifact it places. One source for "what does board@1.0.0 run on" — the
 * registry — is what keeps a node's adjudication honest.
 */

import type { BundleRef, Machine } from "./types.ts"

/** Where an app instance sits inside a node (§8.1, §8.4) — *where*, not *what*. */
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
