import type { NodeControl } from "./transport.ts"
import { runLaunches, type LaunchReport } from "./launch-cycle.ts"
import type { LaunchRunner } from "./launch-order.ts"

export interface LaunchStepOptions {
  readonly machine: { readonly machineId: string }
  readonly launcher?: LaunchRunner
  readonly launchLimit?: number
  readonly onLaunch?: (report: LaunchReport) => void
}

export const launchStep = (
  control: Pick<NodeControl, "claim" | "settle" | "gatewayConfig">, options: LaunchStepOptions,
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
