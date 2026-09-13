/**
 * Artifact distribution — agentd pushes *code*, not just configuration (§7.6):
 * what one artifact *is*, and whether a machine can run it.
 *
 * `adapter.ts` pushes the MCP surface an agent should have. The bundle side
 * pushes the artifacts a machine should run — the kernel and the apps. Same
 * shape, same receipt (`AgentBinding.revision` + `reportApplied`'s 409), same
 * adapter contract (see `bundle-adapter.ts`); the only new question is "can this
 * machine run this artifact?", and this file is where that question is routed.
 *
 * It is *not* answered here. It is answered by the one adjudication the platform
 * already has (`@effect-agent/effect-bundle`'s `assessBundleCompat` /
 * `assessKernelCompat`, §5). Writing a second comparison in agentd would be
 * exactly the "另立 semver 规则" §5 forbids — and would drift from the gate the
 * host actually enforces at load time, which is the only opinion that matters.
 *
 * A machine states what it can run in `Machine.capabilities`:
 *
 *   abi:effect-1 · bootstrap:bootstrap-1 · runtime:os
 *
 * Absent facts fall back to the SDK's own defaults (compat.ts), so an existing
 * machine that declares nothing is adjudicated as an OS host on the current
 * lines — conservative, and identical to what the host would decide.
 */

import {
  assessBundleCompat, assessKernelCompat, kernelRevision,
  type CompatVerdict, type Incompatibility, type KernelRevision,
} from "@effect-agent/effect-bundle"
import { AgentdError } from "./errors.ts"
import type { MachineCapability } from "./machine-capability.ts"
import type { BundleRef } from "./types.ts"

/** `board@1.0.0` — one artifact version, which is what a binding names. */
export const bundleRefId = (bundle: Pick<BundleRef, "bundleId" | "version">): string =>
  `${bundle.bundleId}@${bundle.version}`

/** The default is applied in one place, so "app" is never spelled out by a caller. */
export const bundleKind = (bundle: BundleRef): "app" | "kernel" => bundle.kind ?? "app"

/**
 * Can this machine run this artifact? The verdict is the SDK's, not agentd's —
 * the only work done here is routing an app to the bundle gate and a kernel to
 * the bootstrap gate, which is precisely the split §5 draws.
 */
export const assessBundleForMachine = (bundle: BundleRef, capability: MachineCapability): CompatVerdict => {
  if (bundleKind(bundle) === "kernel") {
    // A kernel that names no host line cannot be adjudicated, and guessing one
    // would be adjudicating a declaration nobody made.
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

/**
 * A pushed kernel artifact, as the host's artifact repo will record it (§6.1) —
 * so what agentd pushes is what `supervisor.stage()` / `EffectServer.stageKernel()`
 * accept, with no translation layer in between that could disagree with the gate.
 *
 * `revision` is the *receiving host's* own monotonic counter, not the binding
 * revision: two machines have two repos, and the receipt's number is not the
 * repo's number. Keeping them separate is why this is a caller-supplied argument
 * rather than something read off `BundleRef`.
 */
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
