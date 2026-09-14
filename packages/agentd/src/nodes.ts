import type { BundleArtifact } from "./bundle-artifact.ts"
import { validateBundleArtifact } from "./bundle-artifact.ts"
import { fail, nonEmpty, record, sameKeys } from "./guards.ts"
import { nodeAppId, validateNodeApp, type NodeAppArtifact } from "./node-placement.ts"
import type { DesiredNode } from "./node-types.ts"
import type { Machine } from "./types.ts"

export interface NodeDeployment {
  readonly nodeId: string
  readonly kernel?: BundleArtifact
  readonly apps: readonly NodeAppArtifact[]
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
  const keys = ["nodeId", "apps", "metadata", ...(deployment.kernel === undefined ? [] : ["kernel"])]
  if (!sameKeys(deployment, keys)) fail("invalid node deployment")
  if (!nonEmpty(deployment.nodeId)) fail("invalid node deployment")
  const kernel = deployment.kernel === undefined ? undefined : validateBundleArtifact(deployment.kernel)
  if (kernel !== undefined && kernel.kind !== "kernel") fail("the kernel slot must hold a kernel artifact")
  if (!Array.isArray(deployment.apps)) fail("invalid node deployment")
  const apps = deployment.apps.map(validateNodeApp)
  const ids = apps.map(nodeAppId)
  if (new Set(ids).size !== ids.length) fail("node deployment places the same app twice at one namespace")
  const metadata: Record<string, unknown> = record(deployment.metadata) ? deployment.metadata : fail("invalid node metadata")
  if (!sameKeys(metadata, ["nodeId", "revision"])) fail("invalid node metadata")
  if (metadata.nodeId !== deployment.nodeId) fail("node metadata does not match the deployment")
  if (typeof metadata.revision !== "number" || !Number.isInteger(metadata.revision) || metadata.revision < 0) fail("invalid node metadata")
  return { nodeId: deployment.nodeId, kernel, apps, metadata: { nodeId: deployment.nodeId, revision: metadata.revision } }
}
