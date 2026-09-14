import type { EffectRuntimeKind } from "@effect-agent/effect-bundle"
import { bundleRuntimes } from "@effect-agent/effect-bundle"
import { AgentdError } from "./errors.ts"
import type { NodeDeployment } from "./nodes.ts"
import type { ResolvedNodeApp } from "./node-types.ts"
import type { Machine } from "./types.ts"

export type DeclaredCapacity = Pick<Machine, "machineId" | "namespaces" | "maxApps">

const admitNamespace = (node: DeclaredCapacity, app: Pick<ResolvedNodeApp, "ns" | "bundleId">): void => {
  if (node.namespaces.includes(app.ns)) return
  const declared = node.namespaces.length === 0 ? "(none declared)" : node.namespaces.join(", ")
  throw new AgentdError(400, `node ${node.machineId} does not carry namespace "${app.ns}" for ${app.bundleId}; it carries ${declared}`)
}

export const admitApps = (node: DeclaredCapacity, apps: readonly ResolvedNodeApp[]): void => {
  for (const app of apps) admitNamespace(node, app)
  if (node.maxApps !== undefined && apps.length > node.maxApps) {
    throw new AgentdError(400, `node ${node.machineId} carries at most ${node.maxApps} apps; this deployment places ${apps.length}`)
  }
}

export const requirableRuntimes = (deployment: NodeDeployment): readonly EffectRuntimeKind[] => {
  const kinds = new Set<EffectRuntimeKind>()
  for (const artifact of [deployment.kernel, ...deployment.apps]) {
    if (artifact === undefined) continue
    for (const runtime of bundleRuntimes(artifact)) kinds.add(runtime)
  }
  return [...kinds]
}
