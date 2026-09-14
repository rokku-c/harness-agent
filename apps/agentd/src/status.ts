import type { AgentdControl } from "@effect-agent/agentd"
import { shownToReader } from "./desired-view.ts"
import type { AppliedReport, NodeAppliedReport } from "./ops/surfaces.ts"

export const makeStatus = (
  control: AgentdControl, applied: Map<string, AppliedReport>, nodeApplied: Map<string, NodeAppliedReport>,
) => () => {
  const base = control.status() as {
    readonly agents?: ReadonlyArray<{ readonly agentId: string }>
    readonly machines?: ReadonlyArray<{ readonly machineId: string }>
  } & Record<string, unknown>
  const held = <T>(read: () => T): T | undefined => { try { return read() } catch { return undefined } }
  return {
    ...base,
    agents: (base.agents ?? []).map((agent) => ({
      ...agent, desired: held(() => shownToReader(control.desired(agent.agentId))), applied: applied.get(agent.agentId) ?? null,
    })),
    machines: (base.machines ?? []).map((machine) => ({
      ...machine, desired: held(() => control.desiredNode(machine.machineId)), applied: nodeApplied.get(machine.machineId) ?? null,
    })),
    nodeLiveness: control.nodeLiveness(),
  }
}
