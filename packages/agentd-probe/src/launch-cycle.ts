import type { LaunchIntent, LaunchState } from "@effect-agent/agentd"
import { asFault } from "./errors.ts"
import { orderOf, type LaunchOrder, type LaunchResult, type LaunchRunner } from "./launch-order.ts"
import type { NodeControl } from "./transport.ts"

/** One intent's trip, as the machine saw it. */
export interface LaunchReport {
  readonly intent: LaunchIntent
  /** What the machine did, or — for work it refused to start — why it did nothing. */
  readonly result: LaunchResult
  /** The state the center was told, which is derived from the result and not a second opinion. */
  readonly state: LaunchState
}

export interface LaunchCycleDeps {
  readonly machineId: string
  readonly control: Pick<NodeControl, "claim" | "settle" | "gatewayConfig">
  readonly runner: LaunchRunner
  /** How many intents one beat takes. Absent = 1: a machine does one thing at a time by default. */
  readonly limit?: number
}

/**
 * An answer is the whole point of a launch, so it is what `detail` carries when
 * the run succeeded; on failure it carries why. Either way the center ends up
 * with something an operator can read, which a bare "done" is not.
 */
const detailOf = (result: LaunchResult): string =>
  (result.ok ? result.output : result.detail ?? "no detail").slice(0, 2000)

/** Work that was never started, at all. Zero elapsed is the truth: nothing ran. */
const notStarted = (detail: string): LaunchResult => ({ ok: false, output: "", detail, durationMs: 0 })

/**
 * One beat's worth of work: claim, arm, say so, run, say how it went.
 *
 * **Arming comes before the claim is announced as running.** A turn starts with
 * the config fetched for its identity (§F10), and a fetch that is refused means
 * that turn cannot reach the platform's tools — so it does not start, and the
 * center is told `failed` with the reason rather than `running` for a process
 * that does not exist.
 *
 * Only a `plan` fault is absorbed here, and that is the whole point of the
 * distinction: it says the *center refused this intent*, one agent nobody issued
 * a credential for or a center that cannot name its door. Every other fault — an
 * unreachable control plane, a rejected node credential — is about this machine
 * or the wire, and rethrowing it leaves the intent claimed to lapse back rather
 * than marking as failed work nobody ever judged.
 *
 * `running` is reported before the agent is spawned rather than after it
 * finishes, because a launch that takes minutes must be visible for those
 * minutes — an intent that stays `claimed` while an agent works is
 * indistinguishable from one a dead machine is holding.
 */
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
