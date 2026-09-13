import { makeNodeArtifactAdapter, type NodeAdapterPlan } from "@effect-agent/agentd"

/**
 * What "apply" means when the node already has the artifacts.
 *
 * The platform's own node adapter is the reference here: its `apply` validates
 * the deployment and returns it, and invents nothing. This does the same, and
 * that is the honest description of what it is — the node *agrees* to a
 * deployment. It does not fetch bundle bytes onto the machine: a default apply
 * that reported having installed something it never fetched would be exactly the
 * lie this layer exists to prevent.
 *
 * A machine that should receive the bytes stages them instead (§8.2, P6) — by
 * passing its own `apply`, or by naming a `stage` root and letting the probe
 * wire {@link stagingApply}. Either way the receipt carries what the machine
 * returns, so "what was applied" is the machine's answer, not the probe's
 * assumption.
 */
export const declarativeApply = (plan: NodeAdapterPlan): Promise<unknown> => makeNodeArtifactAdapter().apply(plan)
