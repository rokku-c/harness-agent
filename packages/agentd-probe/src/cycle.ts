import type { DeclaredMachine, NodeAdapterPlan } from "@effect-agent/agentd"
import type { NodeControl } from "./transport.ts"

export interface CycleDeps {
  readonly machine: DeclaredMachine
  readonly control: NodeControl
  readonly apply: (plan: NodeAdapterPlan) => Promise<unknown>
  /** Whether we believe we hold a lease. A probe that just started does not. */
  readonly leased: boolean
  /**
   * The revision we last receipted. Without it a resident loop would re-apply
   * and re-report the same deployment every beat, and a receipt that arrives
   * every 1.5 seconds stops being a receipt and becomes a heartbeat that
   * happens to carry a deployment.
   */
  readonly reported?: number
}

export type CycleOutcome =
  | { readonly kind: "in-sync"; readonly revision: number }
  | { readonly kind: "applied"; readonly revision: number; readonly changes: readonly string[] }
  | { readonly kind: "apply-failed"; readonly revision: number; readonly error: string }

/**
 * One beat: keep the lease, read what to run, run it, say so.
 *
 * Faults from the control plane are *not* caught here — an unreachable server
 * and an unplaceable deployment need different answers, and the caller that
 * schedules the next beat is the one that has to give them. The local apply is
 * the exception, because a failure there still has a receipt to send.
 */
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
    // A receipt is still owed: the node holds this revision and could not apply
    // it. Saying nothing would leave the operator watching a deployment that is
    // pending forever, with the reason sitting on a machine they cannot see.
    await deps.control.report(nodeId, plan.revision, { ok: false, error: failure })
    return { kind: "apply-failed", revision: plan.revision, error: failure }
  }
  await deps.control.report(nodeId, plan.revision, { ok: true, deployment })
  return { kind: "applied", revision: plan.revision, changes: plan.changes }
}
