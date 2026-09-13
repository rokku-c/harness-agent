/**
 * The node artifact adapter (§8.4). Same contract as the agent-level adapters:
 * plan may refuse, apply invents nothing, and a stale receipt is a 409.
 *
 * Where an agent-level plan adjudicates one artifact, this one adjudicates a set
 * — so a refusal has to name *which* placement lost, because "the plan failed"
 * is not an actionable message when the set has twelve entries. The verdict
 * itself is untouched: it comes from `assessBundleForMachine`, and only the
 * label around it is added here.
 */

import type { CompatVerdict } from "@effect-agent/effect-bundle"
import { artifactOf } from "./bundle-artifact.ts"
import { assessBundleForMachine, bundleRefId } from "./bundles.ts"
import { admitApps } from "./capacity.ts"
import { fail } from "./guards.ts"
import { machineCapability, type MachineCapability } from "./machine-capability.ts"
import { changesOf } from "./node-changes.ts"
import { nodeAppId, placementOf } from "./node-placement.ts"
import type { DesiredNode } from "./node-types.ts"
import { validateNodeDeployment, type NodeAdapter, type NodeAdapterPlan, type NodeDeployment } from "./nodes.ts"
import type { BundleRef, Machine } from "./types.ts"

/**
 * Adjudicate one artifact, labelling the failure with where it was going.
 *
 * The verdict itself is untouched — it comes from `assessBundleForMachine`. Only
 * the wrapper is new, and it exists because a node-level refusal has to be
 * addressable: `cannot place workspace-b::board@1.0.0` beats `cannot push`.
 */
const adjudicate = (label: string, bundle: BundleRef, capability: MachineCapability): void => {
  const verdict: CompatVerdict = assessBundleForMachine(bundle, capability)
  if (!verdict.ok) fail(`cannot place ${label}: ${verdict.reason.message}`)
}

export const makeNodeArtifactAdapter = (): NodeAdapter => ({
  kind: "effect-node",
  validate: validateNodeDeployment,
  plan(node: Machine, desired: DesiredNode, reported?: unknown): NodeAdapterPlan {
    if (!Number.isInteger(desired.revision) || desired.revision < 0) fail("invalid desired revision")
    if (desired.node.machineId !== node.machineId) fail("node identity mismatch")
    const capability = machineCapability(desired.node)

    // What the node says it carries (§8.3) is adjudicated before what it can run,
    // because it needs no registry: a placement into a domain the node never
    // claimed is refused whether or not the artifact exists.
    admitApps(desired.node, desired.apps)

    // Refuse before anything is written down, and say which placement failed.
    if (desired.kernel !== undefined) {
      if ((desired.kernel.kind ?? "app") !== "kernel") fail("a node's kernel slot must hold a kernel artifact")
      adjudicate(`kernel ${bundleRefId(desired.kernel)} on ${node.machineId}`, desired.kernel, capability)
    }
    for (const app of desired.apps) {
      adjudicate(`${nodeAppId(app)} on ${node.machineId}`, app, capability)
    }

    let previous: NodeDeployment | undefined
    if (reported !== undefined) {
      previous = validateNodeDeployment(reported)
      if (previous.nodeId !== node.machineId) fail("reported node identity mismatch")
      if (desired.revision < previous.metadata.revision) fail("stale node revision")
    }

    const deployment: NodeDeployment = {
      nodeId: node.machineId,
      ...(desired.kernel === undefined ? {} : { kernel: artifactOf(desired.kernel) }),
      apps: desired.apps.map(placementOf),
      metadata: { nodeId: node.machineId, revision: desired.revision },
    }
    validateNodeDeployment(deployment)
    return { nodeId: node.machineId, revision: desired.revision, desired: deployment, changes: changesOf(deployment, previous) }
  },
  async apply(plan: NodeAdapterPlan): Promise<NodeDeployment> {
    const deployment = validateNodeDeployment(plan.desired)
    if (plan.nodeId !== deployment.metadata.nodeId || plan.revision !== deployment.metadata.revision) fail("invalid adapter plan")
    return deployment
  },
})
