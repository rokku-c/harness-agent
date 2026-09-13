/**
 * Bundle compatibility — the runtime dimension of docs/architecture-rework.md
 * §7.1, the bundle's own declaration, and the gate that refuses an artifact
 * whose declaration cannot be satisfied (§5).
 *
 * Orthogonal to the ABI is the *runtime target* (§7.1): a host declares which
 * runtime it is, a bundle declares which runtimes it can run in; the ABI line
 * itself is adjudicated one file over (compat-abis.ts).
 *
 * Policy — fail loud: an unsatisfiable declaration is refused with a precise
 * reason, never silently downgraded and never loaded "and hoped for" (§5).
 */

import { assessAbiLine, KERNEL_ABI } from "./compat-abis.ts"
import { reject, type CompatVerdict, type Incompatibility } from "./compat-verdict.ts"

/** Runtimes an app artifact can execute in (docs/architecture-rework.md §7.1). */
export type EffectRuntimeKind = "os" | "browser" | "sandbox"

export const EFFECT_RUNTIME_KINDS: readonly EffectRuntimeKind[] = ["os", "browser", "sandbox"]

/**
 * Default when a bundle declares nothing. Conservative on purpose: an artifact
 * that never opted into portability only runs where it was built — the OS host.
 */
export const DEFAULT_RUNTIME: EffectRuntimeKind = "os"

/** What a bundle (or a bundle manifest) asks the loading host to provide. */
export interface BundleDeclaration {
  readonly bundleId?: string
  readonly abi: string
  readonly runtimes?: readonly EffectRuntimeKind[]
}

/** What the loading host can actually provide. */
export interface HostCapability {
  /** ABI the host implements; defaults to `KERNEL_ABI`. */
  readonly abi?: string
  /** Runtime the host is; defaults to `DEFAULT_RUNTIME`. */
  readonly runtime?: EffectRuntimeKind
}

/** Raised by {@link assertBundleCompat} / `loadEffectBundle` on a refused artifact. */
export class BundleIncompatibleError extends Error {
  readonly reason: Incompatibility
  constructor(bundleId: string, reason: Incompatibility) {
    super(`bundle "${bundleId}" refused: ${reason.message}`)
    this.name = "BundleIncompatibleError"
    this.reason = reason
  }
}

const label = (d: BundleDeclaration): string => d.bundleId ?? "(anonymous bundle)"

/** Declared runtimes, with the conservative default applied. */
export const bundleRuntimes = (d: Pick<BundleDeclaration, "runtimes">): readonly EffectRuntimeKind[] =>
  d.runtimes === undefined || d.runtimes.length === 0 ? [DEFAULT_RUNTIME] : d.runtimes

/** The one runtime check, shared by both artifact kinds. */
export const assessRuntime = (
  runtimes: readonly EffectRuntimeKind[],
  runtime: EffectRuntimeKind,
  subject: string,
): Incompatibility | undefined =>
  runtimes.includes(runtime)
    ? undefined
    : {
        code: "runtime-unsupported",
        required: runtimes.join(" | "),
        provided: runtime,
        message: `${subject} declares runtimes [${runtimes.join(", ")}] but the host runtime is "${runtime}"`,
      }

/** Decide whether a host may load a bundle. Pure — no I/O — so the same verdict can be computed before loading (§6.2 stage). */
export const assessBundleCompat = (declaration: BundleDeclaration, host: HostCapability = {}): CompatVerdict => {
  const haveAbi = host.abi ?? KERNEL_ABI
  const abi = assessAbiLine("effect", declaration.abi, haveAbi, label(declaration))
  if (abi !== undefined) return reject(abi)

  const runtime = assessRuntime(bundleRuntimes(declaration), host.runtime ?? DEFAULT_RUNTIME, label(declaration))
  if (runtime !== undefined) return reject(runtime)

  return { ok: true }
}

/** {@link assessBundleCompat}, throwing instead of returning a verdict. */
export const assertBundleCompat = (declaration: BundleDeclaration, host: HostCapability = {}): void => {
  const verdict = assessBundleCompat(declaration, host)
  if (!verdict.ok) throw new BundleIncompatibleError(label(declaration), verdict.reason)
}

/** One-line human summary of a verdict — for logs, receipts and `/-/` surfaces. */
export const describeCompat = (declaration: BundleDeclaration, host: HostCapability = {}): string => {
  const verdict = assessBundleCompat(declaration, host)
  if (verdict.ok) {
    return `ok: ${label(declaration)} · abi ${declaration.abi} · runtimes [${bundleRuntimes(declaration).join(", ")}]`
  }
  return `refused(${verdict.reason.code}): ${verdict.reason.message}`
}
