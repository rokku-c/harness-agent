/**
 * What a node says it can carry, and whether a deployment fits inside it (§8.3).
 *
 * §8.3 lists three things a node declares: `runtimes` (adjudicated by the SDK's
 * own compat gates, `bundles.ts`), `namespaces`, and a capacity. The two that are
 * *not* about compatibility live here, because they share one property worth
 * stating once: they are about the node's **own declaration**, so they can only
 * be adjudicated where that declaration is in hand — the node's plan
 * (`nodes.ts`), not the registry write. `requirableRuntimes` is the third
 * dimension read from the other side: not "what may this node host" but "what
 * must it host", which is what the node's own capability is compared against.
 *
 * Putting them in `bindNode` would have been one step earlier and wrong twice
 * over: an announce overwrites a machine's declaration, so a node can narrow
 * what it carries *after* a binding exists, and a rule enforced at the write
 * would happily keep serving a deployment the node has since disowned. One
 * gate, at the point where the current declaration is read.
 */

import type { EffectRuntimeKind } from "@effect-agent/effect-bundle"
import { bundleRuntimes } from "@effect-agent/effect-bundle"
import { AgentdError } from "./errors.ts"
// Type-only, so the runtime graph has no edge back to `nodes.ts` (which imports
// this file): the deployment shape lives with the adapter that produces it.
import type { NodeDeployment } from "./nodes.ts"
import type { Machine, ResolvedNodeApp } from "./types.ts"

/** The declaration this file adjudicates against — a node as it currently says it is. */
export type DeclaredCapacity = Pick<Machine, "machineId" | "namespaces" | "maxApps">

/**
 * Refuse a placement the node never said it would carry, naming the domain and
 * what it *did* declare: an operator reading that can tell whether to fix the
 * binding or the node's declaration, which "invalid placement" cannot.
 */
const admitNamespace = (node: DeclaredCapacity, app: Pick<ResolvedNodeApp, "ns" | "bundleId">): void => {
  if (node.namespaces.includes(app.ns)) return
  const declared = node.namespaces.length === 0 ? "(none declared)" : node.namespaces.join(", ")
  throw new AgentdError(400, `node ${node.machineId} does not carry namespace "${app.ns}" for ${app.bundleId}; it carries ${declared}`)
}

export const admitApps = (node: DeclaredCapacity, apps: readonly ResolvedNodeApp[]): void => {
  for (const app of apps) admitNamespace(node, app)
  // Counted after the namespaces are known good, so the message an operator sees
  // is the first thing actually wrong with the deployment rather than the second.
  if (node.maxApps !== undefined && apps.length > node.maxApps) {
    throw new AgentdError(400, `node ${node.machineId} carries at most ${node.maxApps} apps; this deployment places ${apps.length}`)
  }
}

/** Runtimes a node must be able to host to serve this deployment (§8.3). */
export const requirableRuntimes = (deployment: NodeDeployment): readonly EffectRuntimeKind[] => {
  const kinds = new Set<EffectRuntimeKind>()
  for (const artifact of [deployment.kernel, ...deployment.apps]) {
    if (artifact === undefined) continue
    for (const runtime of bundleRuntimes(artifact)) kinds.add(runtime)
  }
  return [...kinds]
}
