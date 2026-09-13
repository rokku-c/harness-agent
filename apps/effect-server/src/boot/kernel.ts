/**
 * This process's kernel, declared (docs/architecture-rework.md §5, §6.1).
 *
 * §6.1 splits the running system in two: the **host invariants** — process,
 * sockets/listeners, the route dispatch point, the artifact repo, the supervisor,
 * the bootstrap ABI — and everything else, which is the *kernel*: plugin host,
 * registries, config runtime, UI hosting, planes, observe, the MCP surface,
 * console.
 *
 * `boot/runtime.ts` is exactly the "kernel + base" mixture §6.1 complains about.
 * What this module adds is the seam, not the split: the kernel states which
 * bootstrap ABI it needs and which `effect-N` line it implements toward its apps,
 * and boot refuses a mismatch before any state is built — the same fail-loud
 * gate(P0) and the same two lines, applied to the other artifact kind.
 *
 * Honest status: today the kernel is this repo's code, not a downloadable
 * artifact, so host and kernel declarations necessarily coincide and
 * `assertKernelBootable` cannot yet fire on a real mismatch. It becomes
 * load-bearing when the supervisor (§6.2, P5) stages a kernel from the artifact
 * repo and flips to it — that is the first moment a kernel could be *other*.
 * Until then, treat this as the contract written down in code: the console can
 * report it, and `assessKernelAgainst` is what the swap will be adjudicated
 * with.
 */

import {
  assertKernelCompat,
  BOOTSTRAP_ABI,
  KERNEL_ABI,
  type BootstrapCapability,
  type KernelDeclaration,
} from "@effect-agent/effect-bundle"

/** The kernel this build ships. Its `abi` is what every loaded app is checked against. */
export const KERNEL: KernelDeclaration = {
  kernelId: "io.effect-agent.effect-server@0.0.0",
  abi: KERNEL_ABI,
  bootstrapAbi: BOOTSTRAP_ABI,
  runtimes: ["os"],
}

/** The revision number this build's kernel carries into the artifact repo. */
export const SHIPPED_REVISION = 1

/** The host's side of the same two lines — what this process can actually provide. */
export const HOST: BootstrapCapability = { bootstrapAbi: BOOTSTRAP_ABI, runtime: "os" }

/** Refuse to boot a kernel the host cannot run. Called before anything is built. */
export const assertKernelBootable = (
  declaration: KernelDeclaration = KERNEL,
  host: BootstrapCapability = HOST,
): KernelDeclaration => {
  assertKernelCompat(declaration, host)
  return declaration
}
