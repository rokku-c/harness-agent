export type AbiLine = "bootstrap" | "effect"

export type IncompatibilityCode = "abi-unparseable" | "abi-mismatch" | "runtime-unsupported" | "capability-missing"

export interface Incompatibility {
  readonly code: IncompatibilityCode
  readonly line?: AbiLine
  readonly required: string
  readonly provided: string
  readonly message: string
}

export type CompatVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: Incompatibility }

export const reject = (reason: Incompatibility): CompatVerdict => ({ ok: false, reason })
