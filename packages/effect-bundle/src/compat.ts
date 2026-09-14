import { assessAbiLine, KERNEL_ABI } from "./compat-abis.ts"
import { reject, type CompatVerdict, type Incompatibility } from "./compat-verdict.ts"

export type EffectRuntimeKind = "os" | "browser" | "sandbox"

export const EFFECT_RUNTIME_KINDS: readonly EffectRuntimeKind[] = ["os", "browser", "sandbox"]

export const DEFAULT_RUNTIME: EffectRuntimeKind = "os"

export interface BundleDeclaration {
  readonly bundleId?: string
  readonly abi: string
  readonly runtimes?: readonly EffectRuntimeKind[]
}

export interface HostCapability {
  readonly abi?: string
  readonly runtime?: EffectRuntimeKind
}

export class BundleIncompatibleError extends Error {
  readonly reason: Incompatibility
  constructor(bundleId: string, reason: Incompatibility) {
    super(`bundle "${bundleId}" refused: ${reason.message}`)
    this.name = "BundleIncompatibleError"
    this.reason = reason
  }
}

const label = (d: BundleDeclaration): string => d.bundleId ?? "(anonymous bundle)"

export const bundleRuntimes = (d: Pick<BundleDeclaration, "runtimes">): readonly EffectRuntimeKind[] =>
  d.runtimes === undefined || d.runtimes.length === 0 ? [DEFAULT_RUNTIME] : d.runtimes

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

export const assessBundleCompat = (declaration: BundleDeclaration, host: HostCapability = {}): CompatVerdict => {
  const haveAbi = host.abi ?? KERNEL_ABI
  const abi = assessAbiLine("effect", declaration.abi, haveAbi, label(declaration))
  if (abi !== undefined) return reject(abi)

  const runtime = assessRuntime(bundleRuntimes(declaration), host.runtime ?? DEFAULT_RUNTIME, label(declaration))
  if (runtime !== undefined) return reject(runtime)

  return { ok: true }
}

export const assertBundleCompat = (declaration: BundleDeclaration, host: HostCapability = {}): void => {
  const verdict = assessBundleCompat(declaration, host)
  if (!verdict.ok) throw new BundleIncompatibleError(label(declaration), verdict.reason)
}

export const describeCompat = (declaration: BundleDeclaration, host: HostCapability = {}): string => {
  const verdict = assessBundleCompat(declaration, host)
  if (verdict.ok) {
    return `ok: ${label(declaration)} · abi ${declaration.abi} · runtimes [${bundleRuntimes(declaration).join(", ")}]`
  }
  return `refused(${verdict.reason.code}): ${verdict.reason.message}`
}
