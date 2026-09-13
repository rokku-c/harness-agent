/**
 * The deployment unit (§8.4): a node's *whole* app set, not one artifact for one
 * agent — and the reader that accepts nothing else.
 *
 * This is the layer above `bundles.ts`, not a second opinion beside it. "Can this
 * node run this artifact?" is still answered by `assessBundleForMachine`, the one
 * adjudication the platform has, which itself routes to the SDK's gates; the
 * adapter that asks it is `node-adapter.ts`, the diff it reports is
 * `node-changes.ts`, and one placement is `node-placement.ts`. What lives here is
 * the resolved shape they share, kept fully resolved so the receiving host
 * applies no defaults of its own and cannot disagree with what was adjudicated.
 *
 * Node identity is agentd's `Machine` (§8.2) and placement addressing is
 * `(ns, bundleId)` (§8.2), so nothing here invents a second notion of "where".
 */

import type { BundleArtifact } from "./bundle-artifact.ts"
import { validateBundleArtifact } from "./bundle-artifact.ts"
import { fail, nonEmpty, record, sameKeys } from "./guards.ts"
import { nodeAppId, validateNodeApp, type NodeAppArtifact } from "./node-placement.ts"
import type { DesiredNode } from "./node-types.ts"
import type { Machine } from "./types.ts"

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
