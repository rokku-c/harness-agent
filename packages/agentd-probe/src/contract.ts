import type { DeclaredMachine, NodeAdapterPlan } from "@effect-agent/agentd"
import type { CallOptions } from "./call.ts"
import type { FactsReport, FactSource } from "./facts-cycle.ts"
import type { LaunchReport } from "./launch-cycle.ts"
import type { LaunchRunner } from "./launch-order.ts"
import type { CycleOutcome } from "./cycle.ts"
import type { ProbeFault } from "./errors.ts"

export type Schedule = (run: () => void, ms: number) => () => void

export interface ProbeOptions {
  readonly url: string
  readonly machine: DeclaredMachine
  readonly token?: string
  readonly intervalMs?: number
  readonly fetch?: CallOptions["fetch"]
  readonly apply?: (plan: NodeAdapterPlan) => Promise<unknown>
  readonly stage?: string
  readonly onEvent?: (event: CycleOutcome | ProbeFault) => void
  readonly onLaunch?: (report: LaunchReport) => void
  readonly schedule?: Schedule
  readonly launcher?: LaunchRunner
  readonly launchLimit?: number
  readonly reporter?: FactSource
  readonly factsIntervalMs?: number
  readonly onFacts?: (report: FactsReport) => void
}

export interface ProbeStatus {
  readonly nodeId: string
  readonly leased: boolean
  readonly reported?: number
  readonly beats: number
  readonly last?: CycleOutcome
  readonly fault?: ProbeFault
  readonly halted?: ProbeFault
  readonly launches?: readonly LaunchReport[]
}

export interface RunningProbe {
  readonly nodeId: string
  status(): ProbeStatus
  stop(): Promise<void>
}
