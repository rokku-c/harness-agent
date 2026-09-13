import type { DeclaredMachine, NodeAdapterPlan } from "@effect-agent/agentd"
import type { CallOptions } from "./call.ts"
import type { FactsReport, FactSource } from "./facts-cycle.ts"
import type { LaunchReport, LaunchRunner } from "./launch-cycle.ts"
import type { CycleOutcome } from "./cycle.ts"
import type { ProbeFault } from "./errors.ts"

/** When the next beat happens. Injectable, so a test drives beats instead of waiting. */
export type Schedule = (run: () => void, ms: number) => () => void

export interface ProbeOptions {
  readonly url: string
  readonly machine: DeclaredMachine
  readonly token?: string
  /** How long between beats. Absent = 1500 ms (`probe.ts`). */
  readonly intervalMs?: number
  readonly fetch?: CallOptions["fetch"]
  readonly apply?: (plan: NodeAdapterPlan) => Promise<unknown>
  /**
   * Where fetched artifacts are installed (§8.2, P6). Absent = this node is only
   * *told* what to run (`declarativeApply`); a machine that should actually
   * receive the bytes names a root, and the probe wires it to the control client
   * it already has — the fetch needs the same credential as every other node
   * verb, which a caller outside the probe has no way to hand over.
   */
  readonly stage?: string
  /** Where the probe says what it did. Absent = nowhere: a library does not print. */
  readonly onEvent?: (event: CycleOutcome | ProbeFault) => void
  /**
   * Where the probe says what became of the work it took. A channel of its own
   * rather than a third arm of `onEvent`: a launch report is not the node's
   * story, and folding it in would make every consumer of the node's own events
   * handle a case that is none of its business.
   */
  readonly onLaunch?: (report: LaunchReport) => void
  readonly schedule?: Schedule
  /**
   * What runs an agent here. Absent = this machine collects and applies but does
   * not launch: a probe with no way to start an agent must not claim an intent
   * and then leave it running forever.
   */
  readonly launcher?: LaunchRunner
  /** How many intents one beat takes. Absent = 1. */
  readonly launchLimit?: number
  /**
   * What this machine's agents are, and the sessions it has. Absent = this
   * machine reports nothing about itself beyond the deployment it runs.
   */
  readonly reporter?: FactSource
  /** How long between collections. Absent = 60 s: slower than a beat by design. */
  readonly factsIntervalMs?: number
  readonly onFacts?: (report: FactsReport) => void
}

export interface ProbeStatus {
  readonly nodeId: string
  readonly leased: boolean
  readonly reported?: number
  readonly beats: number
  readonly last?: CycleOutcome
  /** The most recent fault, cleared by a beat that worked. */
  readonly fault?: ProbeFault
  /** Set when the loop stopped itself, which only a refusal is worth doing. */
  readonly halted?: ProbeFault
  /** The most recent beat's launches, in the order they ran. */
  readonly launches?: readonly LaunchReport[]
}

export interface RunningProbe {
  readonly nodeId: string
  status(): ProbeStatus
  /** Say goodbye and stop beating. Throws if the goodbye could not be delivered. */
  stop(): Promise<void>
}
