/**
 * The node deployment verbs (§8.4): what one node is told to run, and the
 * receipt for it.
 *
 * A binding holds addresses (`ns::bundleId@version`), so a placement is resolved
 * against the registry *here* rather than trusted to restate the artifact's own
 * lines: one source for "what does board@1.0.0 run on" is what stops a placement
 * from contradicting the artifact it places.
 */

import { bundleRefId } from "./bundles.ts"
import type { ControlState } from "./control-state.ts"
import type { AgentdControl } from "./contract.ts"
import { desiredNode as nodeConfig } from "./control-projections.ts"
import { AgentdError } from "./errors.ts"
import { nodeAppId } from "./node-placement.ts"
import type { NodeBinding } from "./node-types.ts"

export const deploymentOps = (control: ControlState): Pick<AgentdControl,
  "bindNode" | "desiredNode" | "reportNodeApplied"> => ({
  bindNode(nodeId, kernelId, apps) {
    if (!control.machines.has(nodeId)) throw new AgentdError(404, "node not found")
    if (kernelId !== undefined) {
      const kernel = control.registry.get(kernelId)
      if (kernel === undefined) throw new AgentdError(404, "bundle not found")
      // A node runs exactly one kernel; an app in the kernel slot would be a
      // category error that only surfaces at load time.
      if ((kernel.kind ?? "app") !== "kernel") throw new AgentdError(400, `${kernelId} is not a kernel artifact`)
    }
    const resolved = apps.map((app) => {
      const id = bundleRefId(app)
      const bundle = control.registry.get(id)
      if (bundle === undefined) throw new AgentdError(404, `bundle not found: ${id}`)
      if ((bundle.kind ?? "app") !== "app") throw new AgentdError(400, `${id} is a kernel artifact; a node app placement must be an app`)
      return { ...bundle, ns: app.ns, ...(app.enabled === undefined ? {} : { enabled: app.enabled }) }
    })
    const addresses = resolved.map(nodeAppId)
    if (new Set(addresses).size !== addresses.length) {
      throw new AgentdError(400, "the same app is placed twice at one namespace")
    }
    const binding: NodeBinding = {
      nodeId, revision: control.bump(), placements: addresses,
      ...(kernelId === undefined ? {} : { kernelId }),
    }
    control.nodes.set(nodeId, {
      binding,
      ...(kernelId === undefined ? {} : { kernel: control.registry.get(kernelId)! }),
      apps: resolved,
    })
    return binding
  },
  desiredNode: (nodeId) => nodeConfig(control, nodeId),
  reportNodeApplied(nodeId, appliedRevision, state) {
    const current = nodeConfig(control, nodeId)
    if (appliedRevision !== current.revision) throw new AgentdError(409, "stale node revision")
    return { nodeId, revision: appliedRevision, state }
  },
})
