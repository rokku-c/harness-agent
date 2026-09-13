/**
 * The node liveness verbs (§8.5-1): a node saying "I am here", "still here" and
 * "gone" — and the derived view an operator reads.
 *
 * These are the only writes that do *not* always move the revision, and that is
 * deliberate: a receipt is about *what to run*, so a heartbeat that invalidated
 * every in-flight receipt would be a liveness mechanism that breaks the
 * deployment it exists to protect. A change in declared capabilities does move
 * it — different capabilities change what may be pushed here.
 */

import type { ControlState } from "./control-state.ts"
import type { AgentdControl, NodeLiveness } from "./contract.ts"
import { AgentdError } from "./errors.ts"
import type { NodePresence } from "./presence.ts"
import { same } from "./stable.ts"

/** A declared machine that has never announced is offline, not missing. */
const presenceOf = (control: ControlState, nodeId: string): NodePresence =>
  control.presence.presence(nodeId) ?? { nodeId, online: false, withdrawn: false }

export const livenessOps = (control: ControlState): Pick<AgentdControl,
  "announceNode" | "heartbeatNode" | "withdrawNode" | "nodePresence" | "nodeLiveness"> => ({
  /**
   * A node saying "I am here" (§8.5-1). It declares who it is and what it can
   * run — the same record `registerMachine` writes, so a machine has one
   * writer, not two — and that declaration is what starts the lease.
   */
  announceNode(machine, token) {
    control.checkId(machine.machineId)
    control.guard.authorizeNode(machine.machineId, token)
    const announced = control.presence.announce(machine.machineId)
    const existing = control.machines.get(machine.machineId)
    // `reportedAt` is stamped from the server's clock, and `DeclaredMachine`
    // has no such field for a caller to fill in — a node's being up is
    // observed here, so the node does not get to say when it was seen.
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
  /** A clean shutdown, which is not a decommission: the machine and its deployment stay. */
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
