import type { AgentdControl } from "@effect-agent/agentd"
import type { AppliedReport, NodeAppliedReport } from "./ops/surfaces.ts"

/**
 * The operator's view: what the control plane believes, joined the way the page
 * reads it.
 *
 * Every fact about one agent is attached to that agent's own record, and the
 * same for a machine, so the page shows one row per subject rather than one
 * list per fact — four lists over the same agents and machines meant four
 * refrains for one emptiness, and a reader holding a revision in one list
 * against a revision in another.
 *
 * Presence is deliberately *not* one of these fields. A machine's `status` is a
 * word someone chose and it keeps claiming `"online"` after the process behind
 * it dies, so the server's observation lives beside the record, derived on read,
 * and a view that put the two in one object would have made them one fact.
 */
export const makeStatus = (
  control: AgentdControl, applied: Map<string, AppliedReport>, nodeApplied: Map<string, NodeAppliedReport>,
) => () => {
  const base = control.status() as {
    readonly agents?: ReadonlyArray<{ readonly agentId: string }>
    readonly machines?: ReadonlyArray<{ readonly machineId: string }>
  } & Record<string, unknown>
  /** A machine nothing was ever bound to is still a row; it has no deployment. */
  const held = <T>(read: () => T): T | undefined => { try { return read() } catch { return undefined } }
  return {
    ...base,
    agents: (base.agents ?? []).map((agent) => ({
      ...agent, desired: held(() => control.desired(agent.agentId)), applied: applied.get(agent.agentId) ?? null,
    })),
    machines: (base.machines ?? []).map((machine) => ({
      ...machine, desired: held(() => control.desiredNode(machine.machineId)), applied: nodeApplied.get(machine.machineId) ?? null,
    })),
    /** The liveness record as `agentd_node_presence` answers it, one lease per machine. */
    nodeLiveness: control.nodeLiveness(),
  }
}
