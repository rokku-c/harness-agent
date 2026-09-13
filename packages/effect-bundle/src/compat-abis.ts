/**
 * The ABI lines — §5's two contract lines, and the one adjudication that applies
 * to either.
 *
 *   | line            | between       | churn    |
 *   |-----------------|---------------|----------|
 *   | `bootstrap ABI` | host ↔ kernel | very low |
 *   | `effect-N`      | kernel ↔ app  | medium   |
 *
 * The bundle gate (compat.ts) runs `effect` through it, the kernel gate
 * (kernel.ts) runs `bootstrap`. The two differ only in the line they name:
 * nothing about "is this line satisfied" is a second mechanism.
 */

import type { AbiLine, Incompatibility } from "./compat-verdict.ts"

/**
 * ABI implemented by this build of the SDK — the `kernel ↔ app` line (§5). A
 * host that speaks a different line overrides it with its own `HostCapability.abi`.
 */
export const KERNEL_ABI = "effect-1"

/**
 * Bootstrap ABI implemented by this build of the host — the `host ↔ kernel` line
 * (§5, §6.1). A kernel artifact declares the bootstrap ABI it needs; a host that
 * implements a newer one refuses kernels that expect an older line and vice
 * versa. Same adjudication, one line over.
 */
export const BOOTSTRAP_ABI = "bootstrap-1"

/** `<prefix>-1` → `<prefix>-1`; anything else has no line → `undefined` (fail loud). */
const lineOf = (abi: string, prefix: string): string | undefined => {
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(abi.trim())
  return match === null ? undefined : `${prefix}-${match[1]}`
}

/**
 * `effect-1` → `effect-1`; `effect-2` → `effect-2`.
 * Anything that is not `effect-<major>` has no line → `undefined` (fail loud).
 */
export const abiLine = (abi: string): string | undefined => lineOf(abi, "effect")

/**
 * Adjudicate one ABI line. Shared by both lines and both artifact kinds (§5) —
 * `assessBundleCompat` uses it for `effect`, the kernel gate for `bootstrap`.
 */
export const assessAbiLine = (
  line: AbiLine,
  wantAbi: string,
  haveAbi: string,
  subject: string,
): Incompatibility | undefined => {
  const want = lineOf(wantAbi, line)
  const have = lineOf(haveAbi, line)
  if (want === undefined) {
    return {
      code: "abi-unparseable",
      line,
      required: wantAbi,
      provided: haveAbi,
      message: `unrecognized abi "${wantAbi}" on ${subject}; expected "${line}-<major>"`,
    }
  }
  if (have === undefined) {
    return {
      code: "abi-unparseable",
      line,
      required: wantAbi,
      provided: haveAbi,
      message: `host declares an unrecognized abi "${haveAbi}"; expected "${line}-<major>"`,
    }
  }
  if (want !== have) {
    return {
      code: "abi-mismatch",
      line,
      required: wantAbi,
      provided: haveAbi,
      // "requires / implements" rather than "targets / implements": the same
      // sentence has to read correctly for an app wanting effect-N and for a
      // kernel needing bootstrap-N.
      message: `${subject} requires ${want} but the host implements ${have}`,
    }
  }
  return undefined
}
