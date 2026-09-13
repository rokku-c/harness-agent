/**
 * Kernel artifacts — the `host ↔ kernel` line of §5, and the compatibility
 * matrix §5 requires before a kernel swap ("换内核前先查全部已加载 app").
 *
 * A kernel is the artifact that owns everything §6.1 leaves outside the host
 * invariants: plugin host, registries, config runtime, UI hosting, planes,
 * observe, the MCP surface, console. It declares two things about itself:
 *
 *   - `bootstrapAbi` — what it needs from the host it runs on (the `bootstrap-N`
 *     line). This is the line the host refuses on: a host implements exactly one.
 *   - `abi` — the `effect-N` line it implements *toward its apps*. This is not
 *     checked against the host; it is what every already-loaded app is checked
 *     against before the swap, via {@link assessKernelAgainst}.
 *
 * Adjudication here is deliberately the same code as the bundle gate — one line
 * over, same verdicts, same codes (see compat.ts). Nothing about "is this kernel
 * compatible" is a second mechanism.
 */

import {
  assessAbiLine,
  assessBundleCompat,
  assessRuntime,
  BOOTSTRAP_ABI,
  bundleRuntimes,
  DEFAULT_RUNTIME,
  type BundleDeclaration,
  type CompatVerdict,
  type EffectRuntimeKind,
  type HostCapability,
  type Incompatibility,
  reject,
} from "./compat.ts"

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

/**
 * Decide whether a host may run a kernel artifact. Pure, so the verdict can be
 * computed for a staged kernel before anything is loaded (§6.2 stage).
 */
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

/**
 * One app as §5's matrix must see it: the name its host loaded it under, and what
 * it declared. Two names on purpose — `appId` is what the app layer can *act* on
 * (§6.5-6 suspends an app by name), while `declaration.bundleId` is the build it
 * came from, which is what a refusal message should show a human. They are not
 * the same string and must not be conflated: a bundle id carries its version, so
 * a version bump would rename the app.
 */
export interface DeclaredApp {
  /** The app-layer name: `effect.bundle.json`'s `appId`, which is `effect.yaml`'s `id`. */
  readonly appId: string
  readonly declaration: BundleDeclaration
}

/** One app the kernel would break by taking over. `app` is a {@link DeclaredApp.appId}. */
export interface KernelAppIncompatibility {
  readonly app: string
  readonly reason: Incompatibility
}

/**
 * The matrix §5 demands before a kernel swap: every already-loaded app
 * adjudicated against the *incoming* kernel, using the bundle gate itself with
 * the kernel standing in for the host. Empty result = the swap keeps every app.
 *
 * It judges the apps the host has *loaded*, not every one it could find on disk:
 * a declaration sitting in a directory nobody loaded cannot be broken by a swap,
 * and naming one would have the supervisor suspending an app that is not running.
 */
export const assessKernelAgainst = (
  kernel: Pick<KernelDeclaration, "abi">,
  apps: readonly DeclaredApp[],
  host: HostCapability = {},
): readonly KernelAppIncompatibility[] => {
  const incompatibilities: KernelAppIncompatibility[] = []
  for (const app of apps) {
    const verdict = assessBundleCompat(app.declaration, { abi: kernel.abi, runtime: host.runtime })
    if (!verdict.ok) incompatibilities.push({ app: app.appId, reason: verdict.reason })
  }
  return incompatibilities
}

/** One-line human summary — for boot logs, receipts and `/-/` surfaces. */
export const describeKernel = (declaration: KernelDeclaration, host: BootstrapCapability = {}): string => {
  const verdict = assessKernelCompat(declaration, host)
  const facts = `${label(declaration)} · effect ${declaration.abi} · runtimes [${bundleRuntimes(declaration).join(", ")}]`
  return verdict.ok ? `ok: ${facts}` : `refused(${verdict.reason.code}): ${verdict.reason.message}`
}
