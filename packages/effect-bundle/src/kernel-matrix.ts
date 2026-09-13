/**
 * The §5 matrix a kernel swap has to satisfy: every app this host has *loaded*,
 * adjudicated against the kernel that is about to take over.
 *
 * The check is the bundle gate itself, with the incoming kernel standing in for
 * the host — "can this app run here?" is the same question whether "here" is a
 * node or a kernel. An app that declared `effect-1` cannot be served by a kernel
 * that only speaks `effect-2`, and that is exactly the comparison the bundle gate
 * already makes. Nothing about the matrix is a second mechanism.
 */
import { assessBundleCompat, type BundleDeclaration, type HostCapability } from "./compat.ts"
import type { Incompatibility } from "./compat-verdict.ts"
import type { KernelDeclaration } from "./kernel.ts"

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
