import type { LaunchIntent, LaunchState } from "@effect-agent/agentd"
import { asFault } from "./errors.ts"
import { orderOf, type LaunchOrder, type LaunchResult, type LaunchRunner } from "./launch-order.ts"
import type { NodeControl } from "./transport.ts"

export interface LaunchReport {
  readonly intent: LaunchIntent
  readonly result: LaunchResult
  readonly state: LaunchState
}

export interface LaunchCycleDeps {
  readonly machineId: string
  readonly control: Pick<NodeControl, "claim" | "settle" | "gatewayConfig">
  readonly runner: LaunchRunner
  readonly limit?: number
}

const detailOf = (result: LaunchResult): string =>
  (result.ok ? result.output : result.detail ?? "no detail").slice(0, 2000)

const notStarted = (detail: string): LaunchResult => ({ ok: false, output: "", detail, durationMs: 0 })

export const runLaunches = async (deps: LaunchCycleDeps): Promise<readonly LaunchReport[]> => {
  const claimed = await deps.control.claim(deps.machineId, deps.limit)
  const reports: LaunchReport[] = []
  for (const intent of claimed) {
    let order: LaunchOrder
    try {
      order = await orderOf(intent, deps.control)
    } catch (error) {
      const fault = asFault(error)
      if (fault.kind !== "plan") throw fault
      await deps.control.settle(intent.intentId, deps.machineId, "failed", detailOf(notStarted(fault.message)))
      reports.push({ intent, result: notStarted(fault.message), state: "failed" })
      continue
    }
    await deps.control.settle(intent.intentId, deps.machineId, "running")
    const result = await deps.runner.run(order)
    const state: LaunchState = result.ok ? "done" : "failed"
    await deps.control.settle(intent.intentId, deps.machineId, state, detailOf(result))
    reports.push({ intent, result, state })
  }
  return reports
}
