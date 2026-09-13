/**
 * Why the probe could not do what it was told, in the ways that each need a
 * different answer. A taxonomy earns its keep only if every kind changes what
 * happens next, so each one here has exactly one response:
 *
 * | kind          | what it is                                        | what the loop does |
 * |---------------|---------------------------------------------------|--------------------|
 * | `unreachable` | no HTTP response at all                            | keep beating; the node ages offline, which is the truth |
 * | `refused`     | 401 / 400 — the control plane said no to *us*      | stop; the same call is refused identically forever |
 * | `unavailable` | 5xx — reached, then broke                          | keep beating; the server may recover |
 * | `lapsed`      | 404 "node is not present" — our lease aged out     | announce again |
 * | `stale`       | 409 — the deployment moved while we were applying  | re-pull next beat; this is progress, not failure |
 * | `plan`        | the plan builder refused this node's deployment    | surface it; never apply, never claim success |
 * | `apply`       | the local side threw — the machine, not the wire   | surface it, receipt the failure, keep retrying |
 *
 * What they all share is that none of them is success. The failure this layer
 * exists to prevent is an unreachable control plane reading as an applied
 * deployment, so "could not ask" and "was told yes" stay different answers all
 * the way out.
 */
export type ProbeFaultKind = "unreachable" | "refused" | "unavailable" | "lapsed" | "stale" | "plan" | "apply"

export class ProbeFault extends Error {
  constructor(readonly kind: ProbeFaultKind, message: string, readonly status?: number) {
    super(message)
    this.name = "ProbeFault"
  }
}

/**
 * The transport is the only layer that classifies, so anything still unlabelled
 * came from the local side — the machine's own apply, or a bug in the probe —
 * and `apply` is the label that sends an operator to the machine instead of to
 * the network.
 */
export const asFault = (value: unknown): ProbeFault =>
  value instanceof ProbeFault ? value : new ProbeFault("apply", value instanceof Error ? value.message : String(value))
