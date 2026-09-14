import type { BundleArtifact } from "./bundle-artifact.ts"
import { bundleRefId } from "./bundles.ts"
import { nodeAppId } from "./node-placement.ts"
import type { NodeDeployment } from "./nodes.ts"
import { same } from "@effect-agent/canonical-json"

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
