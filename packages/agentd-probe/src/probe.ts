import { asFault, type ProbeFault } from "./errors.ts"
import { makeNodeControl, type NodeControl } from "./transport.ts"
import { declarativeApply } from "./apply.ts"
import { stagingApply } from "./stage.ts"
import { runCycle, type CycleOutcome } from "./cycle.ts"
import type { LaunchReport } from "./launch-cycle.ts"
import { factsStep } from "./facts-cycle.ts"
import { launchStep } from "./launch-step.ts"
import type { ProbeOptions, ProbeStatus, RunningProbe, Schedule } from "./contract.ts"

const defaultSchedule: Schedule = (run, ms) => {
  const timer = setTimeout(run, ms)
  return () => clearTimeout(timer)
}

export const startProbe = (options: ProbeOptions): RunningProbe => {
  const nodeId = options.machine.machineId
  const control: NodeControl = makeNodeControl({
    baseUrl: options.url,
    ...(options.token === undefined ? {} : { token: options.token }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  })
  const apply = options.apply ?? (options.stage === undefined ? declarativeApply : stagingApply({ root: options.stage, control }))
  const schedule = options.schedule ?? defaultSchedule, intervalMs = options.intervalMs ?? 1500
  let leased = false, reported: number | undefined, beats = 0
  let last: CycleOutcome | undefined, fault: ProbeFault | undefined, halted: ProbeFault | undefined
  let launched: readonly LaunchReport[] | undefined
  const launch = launchStep(control, options), facts = factsStep(control, options)
  let cancel: (() => void) | undefined, stopped = false

  /**
   * A lease that lapsed while we were away is not a failure — the control plane
   * is telling us to introduce ourselves again, and we can, once, in this beat.
   */
  const beat = async (reintroduce: boolean): Promise<CycleOutcome> => {
    try {
      const outcome = await runCycle({
        machine: options.machine, control, apply, leased, ...(reported === undefined ? {} : { reported }),
      })
      leased = true
      if (outcome.kind === "applied") reported = outcome.revision
      return outcome
    } catch (error) {
      const raised = asFault(error)
      if (raised.kind === "lapsed" && reintroduce) { leased = false; return await beat(false) }
      throw raised
    }
  }
  const tick = async (): Promise<void> => {
    try {
      last = await beat(true); beats += 1; fault = undefined
      options.onEvent?.(last)
      // work is taken only once the node itself is in order: a machine that
      // cannot report a launch has no business claiming one
      if (launch !== undefined) launched = await launch()
      if (facts !== undefined) await facts()
    } catch (error) {
      fault = asFault(error)
      options.onEvent?.(fault)
      /**
       * A refusal is about *this* caller and *this* request shape: the identical
       * call is refused identically forever, and a loop that keeps making it is a
       * spin rather than a retry, so it stops and says so. Every other fault is
       * worth another beat — an unreachable control plane included, because a
       * node that keeps trying and ages offline is telling the truth, while one
       * that gives up is reporting a health it cannot know.
       */
      if (fault.kind === "refused") { halted = fault; return }
    }
    if (!stopped) cancel = schedule(() => void tick(), intervalMs)
  }

  let stopping: Promise<void> | undefined
  const stop = (): Promise<void> => stopping ??= (async () => {
    stopped = true
    cancel?.()
    // The goodbye has to be delivered to count. A `stop` that swallowed an
    // unreachable control plane would report a clean exit for a node that stays
    // listed as up until its lease happens to lapse — the exit and the record
    // disagreeing, which is the one thing withdraw exists to prevent.
    await control.withdraw(nodeId)
    leased = false
  })()
  void tick()

  return {
    nodeId,
    status: () => ({
      nodeId, leased, beats,
      ...(reported === undefined ? {} : { reported }),
      ...(last === undefined ? {} : { last }),
      ...(fault === undefined ? {} : { fault }),
      ...(halted === undefined ? {} : { halted }),
      ...(launched === undefined ? {} : { launches: launched }),
    }),
    stop,
  }
}
