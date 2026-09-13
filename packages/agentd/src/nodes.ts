/**
 * Node-level distribution (§8.4): the deployment unit is a node's *whole* app
 * set, not one artifact for one agent.
 *
 * This is the layer above `bundles.ts`, not a second opinion beside it. The
 * question "can this node run this artifact?" is still answered by
 * {@link assessBundleForMachine} — the one adjudication the platform has, which
 * itself routes to the SDK's gates. All this file adds is iteration: a node-level
 * push has N artifacts to adjudicate, and a failure has to name *which* one,
 * because "the plan failed" is not an actionable message when the set has twelve
 * entries.
 *
 * Node identity is agentd's `Machine` (§8.2) and placement addressing is
 * `(ns, bundleId)` (§8.2), so nothing here invents a second notion of "where".
 */

import { bundleRuntimes, type CompatVerdict } from "@effect-agent/effect-bundle"
import { AgentdError } from "./errors.ts"
import { fail, nonEmpty, record, sameKeys } from "./guards.ts"
import {
  artifactOf, assessBundleForMachine, bundleRefId, machineCapability,
  validateBundleArtifact, type BundleArtifact, type MachineCapability,
} from "./bundles.ts"
import { admitApps } from "./capacity.ts"
import type { BundleRef, DesiredNode, Machine, ResolvedNodeApp } from "./types.ts"
import { same } from "./stable.ts"

/** `ops::board@1.0.0` — a *placement*, which is what a node holds. */
export const nodeAppId = (app: Pick<ResolvedNodeApp, "ns" | "bundleId" | "version">): string =>
  `${app.ns}::${bundleRefId(app)}`

/** An app artifact as placed on a node: the artifact, plus where it sits. */
export interface NodeAppArtifact extends BundleArtifact {
  readonly ns: string
  /** Absent = enabled. */
  readonly enabled?: boolean
}

/**
 * What a node is actually told to run. Fully resolved — kind and runtimes are
 * filled in, so the receiving host applies no defaults of its own and cannot
 * disagree with what was adjudicated here.
 */
export interface NodeDeployment {
  readonly nodeId: string
  readonly kernel?: BundleArtifact
  readonly apps: readonly NodeAppArtifact[]
  /** Same field name as every other agentd plan, so one receipt rule covers all. */
  readonly metadata: { readonly nodeId: string; readonly revision: number }
}

export interface NodeAdapterPlan {
  readonly nodeId: string
  readonly revision: number
  readonly desired: NodeDeployment
  readonly changes: readonly string[]
}

export interface NodeAdapter {
  readonly kind: string
  validate(deployment: unknown): void
  plan(node: Machine, desired: DesiredNode, reported?: unknown): NodeAdapterPlan
  apply(plan: NodeAdapterPlan): Promise<NodeDeployment>
}

const APP_KEYS = ["bundleId", "version", "abi", "runtimes", "ns"]
/** Optional fields are optional in the key set too — `kind: "app"` is the default. */
const appKeys = (app: Record<string, unknown>): readonly string[] => [
  ...APP_KEYS,
  ...(app.kind === undefined ? [] : ["kind"]),
  ...(app.enabled === undefined ? [] : ["enabled"]),
]

const validateNodeApp = (value: unknown): NodeAppArtifact => {
  const app: Record<string, unknown> = record(value) ? value : fail("invalid node app")
  // Validate as an artifact first, so the two ABI lines and the runtime set are
  // adjudicated by the same code the agent-level adapter uses. `ns`/`enabled`
  // are stripped because they are *placement* facts: the artifact validator's
  // job is the artifact, and handing it keys it does not know would make every
  // placement look malformed. `runtimes` is filled from the same default
  // `artifactOf` uses, so a placement that omits it means what a ref means.
  const artifact = validateBundleArtifact({
    bundleId: app.bundleId,
    version: app.version,
    abi: app.abi,
    kind: app.kind ?? "app",
    runtimes: app.runtimes ?? bundleRuntimes(app as unknown as BundleRef),
    ...(app.bootstrapAbi === undefined ? {} : { bootstrapAbi: app.bootstrapAbi }),
  })
  // A kernel in an app slot is the mirror of an app in the kernel slot, and both
  // are category errors rather than compatibility verdicts.
  if (artifact.kind !== "app") fail("a node app placement must be an app artifact, not a kernel")
  if (!nonEmpty(app.ns) || /\s/.test(app.ns)) fail("invalid node app namespace")
  if (!sameKeys(app, appKeys(app))) fail("invalid node app")
  if (app.enabled !== undefined && typeof app.enabled !== "boolean") fail("invalid node app enabled")
  return { ...artifact, ns: app.ns, ...(app.enabled === undefined ? {} : { enabled: app.enabled }) }
}

export const validateNodeDeployment = (value: unknown): NodeDeployment => {
  const deployment: Record<string, unknown> = record(value) ? value : fail("invalid node deployment")
  // `kernel` is genuinely optional: a node may be given apps only, and a plan
  // that omits it is well-formed rather than malformed.
  const keys = ["nodeId", "apps", "metadata", ...(deployment.kernel === undefined ? [] : ["kernel"])]
  if (!sameKeys(deployment, keys)) fail("invalid node deployment")
  if (!nonEmpty(deployment.nodeId)) fail("invalid node deployment")
  const kernel = deployment.kernel === undefined ? undefined : validateBundleArtifact(deployment.kernel)
  if (kernel !== undefined && kernel.kind !== "kernel") fail("the kernel slot must hold a kernel artifact")
  if (!Array.isArray(deployment.apps)) fail("invalid node deployment")
  const apps = deployment.apps.map(validateNodeApp)
  // Identity is the *placement*, so one artifact twice at two namespaces is
  // legal (§8.1) while the same address twice is not.
  const ids = apps.map(nodeAppId)
  if (new Set(ids).size !== ids.length) fail("node deployment places the same app twice at one namespace")
  const metadata: Record<string, unknown> = record(deployment.metadata) ? deployment.metadata : fail("invalid node metadata")
  if (!sameKeys(metadata, ["nodeId", "revision"])) fail("invalid node metadata")
  if (metadata.nodeId !== deployment.nodeId) fail("node metadata does not match the deployment")
  if (typeof metadata.revision !== "number" || !Number.isInteger(metadata.revision) || metadata.revision < 0) fail("invalid node metadata")
  return { nodeId: deployment.nodeId, kernel, apps, metadata: { nodeId: deployment.nodeId, revision: metadata.revision } }
}

const placementOf = (app: ResolvedNodeApp): NodeAppArtifact => ({
  ...artifactOf(app),
  ns: app.ns,
  ...(app.enabled === undefined ? {} : { enabled: app.enabled }),
})

/**
 * Adjudicate one artifact, labelling the failure with where it was going.
 *
 * The verdict itself is untouched — it comes from {@link assessBundleForMachine}.
 * Only the wrapper is new, and it exists because a node-level refusal has to be
 * addressable: `cannot place workspace-b::board@1.0.0` beats `cannot push`.
 */
const adjudicate = (label: string, bundle: BundleRef, capability: MachineCapability): void => {
  const verdict: CompatVerdict = assessBundleForMachine(bundle, capability)
  if (!verdict.ok) fail(`cannot place ${label}: ${verdict.reason.message}`)
}

const changesOf = (next: NodeDeployment, previous?: NodeDeployment): readonly string[] => {
  const line = (artifact: BundleArtifact | undefined, prefix: string): readonly string[] =>
    artifact === undefined ? [] : [`${prefix} ${bundleRefId(artifact)} (${artifact.kind})`]
  const byAddress = (deployment: NodeDeployment) =>
    new Map(deployment.apps.map((app) => [nodeAppId(app), app]))
  if (previous === undefined) {
    return [...line(next.kernel, "install"), ...next.apps.map((app) => `place ${nodeAppId(app)}`)]
  }
  const nextApps = byAddress(next), prevApps = byAddress(previous)
  const changes: string[] = []
  // The kernel is compared as a whole: a node runs exactly one, so "update" is
  // the honest word when either its version or its declared lines moved.
  if (!same(previous.kernel, next.kernel)) {
    if (previous.kernel !== undefined) changes.push(`remove kernel ${bundleRefId(previous.kernel)}`)
    changes.push(...line(next.kernel, "install"))
  }
  for (const [id, app] of nextApps) {
    const old = prevApps.get(id)
    if (old === undefined) changes.push(`place ${id}`)
    else if (!same(old, app)) changes.push(`update ${id}`)
  }
  for (const id of prevApps.keys()) {
    if (!nextApps.has(id)) changes.push(`remove ${id}`)
  }
  return changes
}

/**
 * The node artifact adapter (§8.4). Same contract as the agent-level adapters:
 * plan may refuse, apply invents nothing, and a stale receipt is a 409.
 */
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
