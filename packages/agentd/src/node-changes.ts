/**
 * What a node push changes — the plan's `changes`, computed from two deployments.
 *
 * A node-level push has N placements, so "it changed" is not what an operator
 * needs: they need *which* placement moved. The diff is therefore addressable
 * (`ns::bundleId@version`) while the kernel is compared as a whole, because a
 * node runs exactly one and "update" is the honest word when either its version
 * or its declared lines moved.
 */

import type { BundleArtifact } from "./bundle-artifact.ts"
import { bundleRefId } from "./bundles.ts"
import { nodeAppId } from "./node-placement.ts"
import type { NodeDeployment } from "./nodes.ts"
import { same } from "./stable.ts"

export const changesOf = (next: NodeDeployment, previous?: NodeDeployment): readonly string[] => {
  const line = (artifact: BundleArtifact | undefined, prefix: string): readonly string[] =>
    artifact === undefined ? [] : [`${prefix} ${bundleRefId(artifact)} (${artifact.kind})`]
  const byAddress = (deployment: NodeDeployment) =>
    new Map(deployment.apps.map((app) => [nodeAppId(app), app]))
  if (previous === undefined) {
    return [...line(next.kernel, "install"), ...next.apps.map((app) => `place ${nodeAppId(app)}`)]
  }
  const nextApps = byAddress(next), prevApps = byAddress(previous)
  const changes: string[] = []
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
