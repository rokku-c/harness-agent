import {
  assessBundleCompat, assessKernelCompat, kernelRevision,
  type CompatVerdict, type Incompatibility, type KernelRevision,
} from "@effect-agent/effect-bundle"
import { AgentdError } from "./errors.ts"
import type { MachineCapability } from "./machine-capability.ts"
import type { BundleRef } from "./types.ts"

export const bundleRefId = (bundle: Pick<BundleRef, "bundleId" | "version">): string =>
  `${bundle.bundleId}@${bundle.version}`

export const bundleKind = (bundle: BundleRef): "app" | "kernel" => bundle.kind ?? "app"

export const assessBundleForMachine = (bundle: BundleRef, capability: MachineCapability): CompatVerdict => {
  if (bundleKind(bundle) === "kernel") {
    if (bundle.bootstrapAbi === undefined) {
      return {
        ok: false,
        reason: {
          code: "abi-unparseable",
          line: "bootstrap",
          required: "(none declared)",
          provided: capability.bootstrapAbi ?? "(host default)",
          message: `kernel "${bundle.bundleId}" declares no bootstrapAbi; a kernel must name the host line it needs`,
        } satisfies Incompatibility,
      }
    }
    return assessKernelCompat(
      { kernelId: bundle.bundleId, abi: bundle.abi, bootstrapAbi: bundle.bootstrapAbi, runtimes: bundle.runtimes },
      { bootstrapAbi: capability.bootstrapAbi, runtime: capability.runtime },
    )
  }
  return assessBundleCompat(
    { bundleId: bundle.bundleId, abi: bundle.abi, runtimes: bundle.runtimes },
    { abi: capability.abi, runtime: capability.runtime },
  )
}

export const kernelRevisionOf = (bundle: BundleRef, revision: number, dir?: string): KernelRevision => {
  if (bundleKind(bundle) !== "kernel" || bundle.bootstrapAbi === undefined) {
    throw new AgentdError(400, `bundle ${bundleRefId(bundle)} is not a kernel artifact; only a kernel can be staged`)
  }
  return kernelRevision(
    { kernelId: bundle.bundleId, abi: bundle.abi, bootstrapAbi: bundle.bootstrapAbi, runtimes: bundle.runtimes },
    revision,
    dir,
  )
}
