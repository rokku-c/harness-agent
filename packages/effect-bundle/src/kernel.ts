import { assessAbiLine, BOOTSTRAP_ABI } from "./compat-abis.ts"
import { assessRuntime, bundleRuntimes, DEFAULT_RUNTIME, type EffectRuntimeKind } from "./compat.ts"
import { reject, type CompatVerdict, type Incompatibility } from "./compat-verdict.ts"

export interface KernelDeclaration {
  readonly kernelId?: string
  readonly abi: string
  readonly bootstrapAbi: string
  readonly runtimes?: readonly EffectRuntimeKind[]
}

export interface BootstrapCapability {
  readonly bootstrapAbi?: string
  readonly runtime?: EffectRuntimeKind
}

export class KernelIncompatibleError extends Error {
  readonly reason: Incompatibility
  constructor(kernelId: string, reason: Incompatibility) {
    super(`kernel "${kernelId}" refused: ${reason.message}`)
    this.name = "KernelIncompatibleError"
    this.reason = reason
  }
}

const label = (declaration: KernelDeclaration): string => declaration.kernelId ?? "(anonymous kernel)"

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

export const assertKernelCompat = (declaration: KernelDeclaration, host: BootstrapCapability = {}): void => {
  const verdict = assessKernelCompat(declaration, host)
  if (!verdict.ok) throw new KernelIncompatibleError(label(declaration), verdict.reason)
}

export const describeKernel = (declaration: KernelDeclaration, host: BootstrapCapability = {}): string => {
  const verdict = assessKernelCompat(declaration, host)
  const facts = `${label(declaration)} · effect ${declaration.abi} · runtimes [${bundleRuntimes(declaration).join(", ")}]`
  return verdict.ok ? `ok: ${facts}` : `refused(${verdict.reason.code}): ${verdict.reason.message}`
}
