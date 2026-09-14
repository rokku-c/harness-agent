import type { MachineReport, SessionRecord } from "@effect-agent/agentd"
import type { NodeControl } from "./transport.ts"

export interface CollectedMachine {
  readonly machineId: string
  readonly facts?: unknown
  readonly sessions?: readonly SessionRecord[]
  readonly note?: string
}

export interface FactSource {
  readonly collect: () => Promise<readonly CollectedMachine[]>
}

export interface FactsReport {
  readonly at: number
  readonly machines: readonly MachineReport[]
}

export interface FactsCycleDeps {
  readonly control: Pick<NodeControl, "reportFacts" | "reportSessions" | "reportNote">
  readonly source: FactSource
}

export const runFacts = async (deps: FactsCycleDeps): Promise<readonly MachineReport[]> => {
  const collected: MachineReport[] = []
  for (const machine of await deps.source.collect()) {
    if (machine.facts !== undefined) collected.push(await deps.control.reportFacts(machine.machineId, machine.facts))
    if (machine.sessions !== undefined) collected.push(await deps.control.reportSessions(machine.machineId, machine.sessions))
    if (machine.note !== undefined) collected.push(await deps.control.reportNote(machine.machineId, machine.note))
  }
  return collected
}

export interface FactsStepOptions {
  readonly reporter?: FactSource
  readonly factsIntervalMs?: number
  readonly onFacts?: (report: FactsReport) => void
}

export const factsStep = (
  control: Pick<NodeControl, "reportFacts" | "reportSessions" | "reportNote">, options: FactsStepOptions,
): (() => Promise<readonly MachineReport[]>) | undefined => {
  const { reporter } = options
  if (reporter === undefined) return undefined
  const everyMs = options.factsIntervalMs ?? 60_000
  let collectedAt: number | undefined
  return async () => {
    const at = Date.now()
    if (collectedAt !== undefined && at - collectedAt < everyMs) return []
    collectedAt = at
    const machines = await runFacts({ control, source: reporter })
    options.onFacts?.({ at, machines })
    return machines
  }
}
