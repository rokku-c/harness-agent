import type { MachineReport, SessionRecord } from "@effect-agent/agentd"
import type { NodeControl } from "./transport.ts"

/**
 * One machine's worth of what was found: what its agents are configured to talk
 * to, and the sessions it has on disk. `machineId` is named per report rather
 * than once for the batch, because a machine collects for hosts it can reach as
 * well as for itself — a host that cannot run an agentd (no runtime, no room)
 * still has sessions, and ssh is how they are read.
 */
export interface CollectedMachine {
  readonly machineId: string
  /** The probe's own facts payload, passed through untouched. */
  readonly facts?: unknown
  readonly sessions?: readonly SessionRecord[]
  /**
   * Set instead of facts or sessions when the machine could not be read — an ssh
   * host that did not answer. Silence would leave the last snapshot standing and
   * read as a machine with nothing to report.
   */
  readonly note?: string
}

/**
 * Where a machine's facts come from, declared structurally: how this machine
 * finds out — its own home directories, or `ssh` to a host that has no agentd —
 * is the host program's business, and this package should not care which.
 */
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

/** Collect, then say. A report is a snapshot, so nothing is merged or kept here. */
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
  /** Absent = this machine does not collect, and nothing is reported about it. */
  readonly reporter?: FactSource
  /** How long between collections. Absent = 60 s. */
  readonly factsIntervalMs?: number
  readonly onFacts?: (report: FactsReport) => void
}

/**
 * The beat's facts step, or nothing when this machine does not collect. It keeps
 * its own clock: an installed agent or a new session changes on the scale of
 * minutes, and re-reading every home directory — and ssh-ing to other hosts —
 * once per 1.5 s beat would be a load the answer does not justify.
 */
export const factsStep = (
  control: Pick<NodeControl, "reportFacts" | "reportSessions" | "reportNote">, options: FactsStepOptions,
): (() => Promise<readonly MachineReport[]>) | undefined => {
  const { reporter } = options
  if (reporter === undefined) return undefined
  const everyMs = options.factsIntervalMs ?? 60_000
  let collectedAt: number | undefined
  return async () => {
    const at = Date.now()
    // nothing collected is not a report: a beat inside the window says nothing
    if (collectedAt !== undefined && at - collectedAt < everyMs) return []
    collectedAt = at
    const machines = await runFacts({ control, source: reporter })
    options.onFacts?.({ at, machines })
    return machines
  }
}
