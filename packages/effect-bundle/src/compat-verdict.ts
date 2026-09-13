/**
 * How a refusal is written — the record both §5 gates return, and the verdict
 * that carries it.
 *
 * Written once so a refusal reads the same however it was reached: the bundle
 * gate (compat.ts) and the kernel gate (kernel.ts) differ in which line they
 * adjudicate, not in how a "no" is spelled, so an operator can put the two side
 * by side without translating between two vocabularies.
 */

/** Which of the two contract lines a verdict is about. */
export type AbiLine = "bootstrap" | "effect"

export type IncompatibilityCode = "abi-unparseable" | "abi-mismatch" | "runtime-unsupported" | "capability-missing"

export interface Incompatibility {
  readonly code: IncompatibilityCode
  /** Which contract line failed. Absent when the reason is not an ABI-line problem. */
  readonly line?: AbiLine
  /** what the artifact asked for */
  readonly required: string
  /** what the host provides */
  readonly provided: string
  readonly message: string
}

export type CompatVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: Incompatibility }

/** The refusal verdict, written once: every gate returns it, so a refusal reads the same however it was reached. */
export const reject = (reason: Incompatibility): CompatVerdict => ({ ok: false, reason })
