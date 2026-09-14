import type { DeclaredMachine, NodeAdapterPlan } from "@effect-agent/agentd"
import type { NodeControl } from "./transport.ts"

export interface CycleDeps {
  readonly machine: DeclaredMachine
  readonly control: NodeControl
  readonly apply: (plan: NodeAdapterPlan) => Promise<unknown>
  readonly leased: boolean
  readonly reported?: number
}

export type CycleOutcome =
  | { readonly kind: "in-sync"; readonly revision: number }
  | { readonly kind: "applied"; readonly revision: number; readonly changes: readonly string[] }
  | { readonly kind: "apply-failed"; readonly revision: number; readonly error: string }

export const runCycle = async (deps: CycleDeps): Promise<CycleOutcome> => {
  const nodeId = deps.machine.machineId
  if (deps.leased) await deps.control.heartbeat(nodeId)
  else await deps.control.announce(deps.machine)

  const plan = await deps.control.plan(nodeId)
  if (plan.revision === deps.reported) return { kind: "in-sync", revision: plan.revision }

  let deployment: unknown
  try {
    deployment = await deps.apply(plan)
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error)
    await deps.control.report(nodeId, plan.revision, { ok: false, error: failure })
    return { kind: "apply-failed", revision: plan.revision, error: failure }
  }
  await deps.control.report(nodeId, plan.revision, { ok: true, deployment })
  return { kind: "applied", revision: plan.revision, changes: plan.changes }
}
