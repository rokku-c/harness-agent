/**
 * Kernel artifacts — the `host ↔ kernel` line of §5, and the gate a kernel
 * passes before it goes anywhere near a running system.
 *
 * A kernel is the artifact that owns everything §6.1 leaves outside the host
 * invariants: plugin host, registries, config runtime, UI hosting, planes,
 * observe, the MCP surface, console. It declares two things about itself:
 *
 *   - `bootstrapAbi` — what it needs from the host it runs on (the `bootstrap-N`
 *     line). This is the line the host refuses on: a host implements exactly one.
 *   - `abi` — the `effect-N` line it implements *toward its apps*. This is not
 *     checked against the host; it is what every already-loaded app is checked
 *     against before a swap (see kernel-matrix.ts).
 *
 * Adjudication here is deliberately the same code as the bundle gate — one line
 * over, same verdicts, same codes (see compat-abis.ts). Nothing about "is this
 * kernel compatible" is a second mechanism.
 */
import { assessAbiLine, BOOTSTRAP_ABI } from "./compat-abis.ts"
import { assessRuntime, bundleRuntimes, DEFAULT_RUNTIME, type EffectRuntimeKind } from "./compat.ts"
import { reject, type CompatVerdict, type Incompatibility } from "./compat-verdict.ts"

/** What a kernel artifact declares about itself. */
export interface KernelDeclaration {
  readonly kernelId?: string
  /** `effect-N` line the kernel implements toward its apps. */
  readonly abi: string
  /** `bootstrap-N` line the kernel needs from the host (§6.1). */
  readonly bootstrapAbi: string
  /** Runtimes the kernel itself can execute in; absent = ["os"]. */
  readonly runtimes?: readonly EffectRuntimeKind[]
}

/** What the host provides to a kernel — its side of the same two lines. */
export interface BootstrapCapability {
  /** Bootstrap line this host implements; defaults to {@link BOOTSTRAP_ABI}. */
  readonly bootstrapAbi?: string
  /** Runtime the host is; defaults to {@link DEFAULT_RUNTIME}. */
  readonly runtime?: EffectRuntimeKind
}

/** Raised when the host refuses a kernel artifact. */
export class KernelIncompatibleError extends Error {
  readonly reason: Incompatibility
  constructor(kernelId: string, reason: Incompatibility) {
    super(`kernel "${kernelId}" refused: ${reason.message}`)
    this.name = "KernelIncompatibleError"
    this.reason = reason
  }
}

const label = (declaration: KernelDeclaration): string => declaration.kernelId ?? "(anonymous kernel)"

/** Decide whether a host may run a kernel. Pure, so the verdict can be computed for a staged kernel before anything is loaded (§6.2 stage). */
export const assessKernelCompat = (
  declaration: KernelDeclaration,
  host: BootstrapCapability = {},
): CompatVerdict => {
  const haveAbi = host.bootstrapAbi ?? BOOTSTRAP_ABI
  const abi = assessAbiLine("bootstrap", declaration.bootstrapAbi, haveAbi, label(declaration))
  if (abi !== undefined) return reject(abi)

  const runtime = assessRuntime(bundleRuntimes(declaration), host.runtime ?? DEFAULT_RUNTIME, label(declaration))
  if (runtime !== undefined) return reject(runtime)

  return { ok: true }
}

/** {@link assessKernelCompat}, throwing instead of returning a verdict. */
export const assertKernelCompat = (declaration: KernelDeclaration, host: BootstrapCapability = {}): void => {
  const verdict = assessKernelCompat(declaration, host)
  if (!verdict.ok) throw new KernelIncompatibleError(label(declaration), verdict.reason)
}

/** One-line human summary — for boot logs, receipts and `/-/` surfaces. */
export const describeKernel = (declaration: KernelDeclaration, host: BootstrapCapability = {}): string => {
  const verdict = assessKernelCompat(declaration, host)
  const facts = `${label(declaration)} · effect ${declaration.abi} · runtimes [${bundleRuntimes(declaration).join(", ")}]`
  return verdict.ok ? `ok: ${facts}` : `refused(${verdict.reason.code}): ${verdict.reason.message}`
}
