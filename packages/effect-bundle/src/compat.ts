/**
 * Bundle compatibility — the ABI line and the runtime dimension.
 *
 * See docs/architecture-rework.md §5 (versions / ABI) and §7 (runtime portability).
 *
 * Two contract lines exist in the platform:
 *
 *   | line             | between          | churn  |
 *   |------------------|------------------|--------|
 *   | `bootstrap ABI`  | host ↔ kernel    | very low |
 *   | `effect-N`       | kernel ↔ app     | medium   |  ← this file's subject
 *
 * Orthogonal to the ABI is the *runtime target* (§7.1): the same app artifact
 * must be loadable in an OS process, a browser, or a JS sandbox. A host declares
 * which runtime it is; a bundle declares which runtimes it can run in.
 *
 * Policy — fail loud: an artifact whose declarations cannot be satisfied is
 * refused with a precise reason. Never silently downgraded, and never loaded
 * "and hoped for" (the repo-wide stance; see §5).
 */

/** Runtimes an app artifact can execute in (docs/architecture-rework.md §7.1). */
export type EffectRuntimeKind = "os" | "browser" | "sandbox"

export const EFFECT_RUNTIME_KINDS: readonly EffectRuntimeKind[] = ["os", "browser", "sandbox"]

/**
 * Default when a bundle declares nothing. Conservative on purpose: an artifact
 * that never opted into portability only runs where it was built — the OS host.
 */
export const DEFAULT_RUNTIME: EffectRuntimeKind = "os"

/**
 * ABI implemented by this build of the SDK — the `kernel ↔ app` line (§5).
 * A host that speaks a different line may override it via {@link HostCapability.abi}.
 */
export const KERNEL_ABI = "effect-1"

/**
 * Bootstrap ABI implemented by this build of the host — the `host ↔ kernel` line
 * (§5, §6.1). A kernel artifact declares the bootstrap ABI it needs; a host that
 * implements a newer one refuses kernels that expect an older line and vice
 * versa. Same adjudication, one line over.
 */
export const BOOTSTRAP_ABI = "bootstrap-1"

/** Which of the two contract lines a verdict is about. */
export type AbiLine = "bootstrap" | "effect"

/** What a bundle (or a bundle manifest) asks the loading host to provide. */
export interface BundleDeclaration {
  readonly bundleId?: string
  readonly abi: string
  readonly runtimes?: readonly EffectRuntimeKind[]
}

/** What the loading host can actually provide. */
export interface HostCapability {
  /** ABI the host implements; defaults to {@link KERNEL_ABI}. */
  readonly abi?: string
  /** Runtime the host is; defaults to {@link DEFAULT_RUNTIME}. */
  readonly runtime?: EffectRuntimeKind
}

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

/** Raised by {@link assertBundleCompat} / `loadEffectBundle` on a refused artifact. */
export class BundleIncompatibleError extends Error {
  readonly reason: Incompatibility
  constructor(bundleId: string, reason: Incompatibility) {
    super(`bundle "${bundleId}" refused: ${reason.message}`)
    this.name = "BundleIncompatibleError"
    this.reason = reason
  }
}

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

/** The bootstrap line's counterpart of {@link abiLine} — `bootstrap-<major>`. */
export const bootstrapAbiLine = (abi: string): string | undefined => lineOf(abi, "bootstrap")

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


const label = (d: BundleDeclaration): string => d.bundleId ?? "(anonymous bundle)"

/** Declared runtimes, with the conservative default applied. */
export const bundleRuntimes = (d: Pick<BundleDeclaration, "runtimes">): readonly EffectRuntimeKind[] =>
  d.runtimes === undefined || d.runtimes.length === 0 ? [DEFAULT_RUNTIME] : d.runtimes

const reject = (reason: Incompatibility): CompatVerdict => ({ ok: false, reason })

/**
 * Decide whether a host may load a bundle. Pure — no I/O — so the same verdict
 * can be computed before loading (§6.2 stage), not only at load time.
 */
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
