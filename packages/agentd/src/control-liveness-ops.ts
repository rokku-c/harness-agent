import type { ControlState } from "./control-state.ts"
import type { AgentdControl, NodeLiveness } from "./contract.ts"
import { AgentdError } from "./errors.ts"
import type { NodePresence } from "./presence.ts"
import { same } from "@effect-agent/canonical-json"

const presenceOf = (control: ControlState, nodeId: string): NodePresence =>
  control.presence.presence(nodeId) ?? { nodeId, online: false, withdrawn: false }

export const livenessOps = (control: ControlState): Pick<AgentdControl,
  "announceNode" | "heartbeatNode" | "withdrawNode" | "nodePresence" | "nodeLiveness"> => ({
  announceNode(machine, token) {
    control.checkId(machine.machineId)
    control.guard.authorizeNode(machine.machineId, token)
    const announced = control.presence.announce(machine.machineId)
    const existing = control.machines.get(machine.machineId)
    control.machines.set(machine.machineId, { ...machine, reportedAt: announced.lastSeen ?? 0 })
    if (existing === undefined || !same(existing.capabilities, machine.capabilities)) control.bump()
    return announced
  },
  heartbeatNode(nodeId, token) {
    control.guard.authorizeNode(nodeId, token)
    const beat = control.presence.heartbeat(nodeId)
    if (beat === undefined) throw new AgentdError(404, "node is not present; announce first")
    const known = control.machines.get(nodeId)
    if (known !== undefined && beat.lastSeen !== undefined) {
      control.machines.set(nodeId, { ...known, reportedAt: beat.lastSeen })
    }
    return beat
  },
  withdrawNode(nodeId, token) {
    control.guard.authorizeNode(nodeId, token)
    const gone = control.presence.withdraw(nodeId)
    if (gone === undefined) throw new AgentdError(404, "node is not present; announce first")
    return gone
  },
  nodePresence(nodeId) {
    if (!control.machines.has(nodeId)) throw new AgentdError(404, "node not found")
    return presenceOf(control, nodeId)
  },
  nodeLiveness(): NodeLiveness {
    return {
      tokenRequired: control.guard.tokenRequired,
      nodes: [...control.machines.keys()].map((nodeId) => presenceOf(control, nodeId)),
    }
  },
})
