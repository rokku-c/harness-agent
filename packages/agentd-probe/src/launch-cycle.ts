import type { LaunchIntent, LaunchState } from "@effect-agent/agentd"
import type { NodeControl } from "./transport.ts"

/**
 * What the probe needs from whatever runs agents here, declared structurally on
 * purpose. Choosing a CLI dialect is the machine host's business, and a package
 * whose job is to be the machine's voice to the control plane should not also
 * carry an opinion about how `claude` spells its flags. `agentdeck`'s `Launcher`
 * fits this without a cast; so does a script.
 */
export interface LaunchOrder {
  readonly kind: string
  readonly workdir: string
  readonly prompt: string
  /** Named when the work is a command rather than an agent turn — an install, say. */
  readonly command?: string
  readonly args?: readonly string[]
}

export interface LaunchResult {
  readonly ok: boolean
  readonly output: string
  readonly detail?: string
  readonly durationMs: number
}

export interface LaunchRunner {
  readonly run: (order: LaunchOrder) => Promise<LaunchResult>
}

/** One intent's trip, as the machine saw it. */
export interface LaunchReport {
  readonly intent: LaunchIntent
  readonly result: LaunchResult
  /** The state the center was told, which is derived from the result and not a second opinion. */
  readonly state: LaunchState
}

export interface LaunchCycleDeps {
  readonly machineId: string
  /** Only these two verbs are used, so a fake in a test needs only these two. */
  readonly control: Pick<NodeControl, "claim" | "settle">
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

/**
 * One beat's worth of work: claim, say so, run, say how it went. The claim is
 * reported as `running` before the agent starts rather than after it finishes,
 * because a launch that takes minutes must be visible for those minutes — an
 * intent that stays `claimed` while an agent works is indistinguishable from
 * one a dead machine is holding.
 */
export const runLaunches = async (deps: LaunchCycleDeps): Promise<readonly LaunchReport[]> => {
  const claimed = await deps.control.claim(deps.machineId, deps.limit)
  const reports: LaunchReport[] = []
  for (const intent of claimed) {
    await deps.control.settle(intent.intentId, deps.machineId, "running")
    const result = await deps.runner.run({
      kind: intent.kind, workdir: intent.workdir, prompt: intent.prompt,
      ...(intent.command === undefined ? {} : { command: intent.command }),
      ...(intent.args === undefined ? {} : { args: intent.args }),
    })
    const state: LaunchState = result.ok ? "done" : "failed"
    await deps.control.settle(intent.intentId, deps.machineId, state, detailOf(result))
    reports.push({ intent, result, state })
  }
  return reports
}
