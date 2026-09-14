export type ProbeFaultKind = "unreachable" | "refused" | "unavailable" | "lapsed" | "stale" | "plan" | "apply"

export class ProbeFault extends Error {
  constructor(readonly kind: ProbeFaultKind, message: string, readonly status?: number) {
    super(message)
    this.name = "ProbeFault"
  }
}

export const asFault = (value: unknown): ProbeFault =>
  value instanceof ProbeFault ? value : new ProbeFault("apply", value instanceof Error ? value.message : String(value))
