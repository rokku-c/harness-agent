import type { NodeControl } from "./transport.ts"
import { runLaunches, type LaunchReport, type LaunchRunner } from "./launch-cycle.ts"

/**
 * The slice of the probe's own options a launch step reads. Named to match, so
 * the probe hands over what it already has instead of restating it: the launch
 * step is part of the beat, not a second configuration of it.
 */
export interface LaunchStepOptions {
  readonly machine: { readonly machineId: string }
  /** Absent = this machine does not launch: a probe that cannot start an agent must not claim work. */
  readonly launcher?: LaunchRunner
  readonly launchLimit?: number
  readonly onLaunch?: (report: LaunchReport) => void
}

/**
 * The beat's launch step, or nothing at all when this machine has no way to run
 * an agent. Wired here rather than at the call site so that "the probe claims
 * work" and "the probe reports what became of it" cannot come apart: a claim
 * whose report was forgotten is an intent stranded at `running` forever.
 */
export const launchStep = (
  control: Pick<NodeControl, "claim" | "settle">, options: LaunchStepOptions,
): (() => Promise<readonly LaunchReport[]>) | undefined => {
  const { launcher } = options
  if (launcher === undefined) return undefined
  const limit = options.launchLimit
  return async () => {
    const reports = await runLaunches({
      machineId: options.machine.machineId, control, runner: launcher,
      ...(limit === undefined ? {} : { limit }),
    })
    for (const report of reports) options.onLaunch?.(report)
    return reports
  }
}
