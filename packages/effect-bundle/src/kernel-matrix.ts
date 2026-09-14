import { assessBundleCompat, type BundleDeclaration, type HostCapability } from "./compat.ts"
import type { Incompatibility } from "./compat-verdict.ts"
import type { KernelDeclaration } from "./kernel.ts"

export interface DeclaredApp {
  readonly appId: string
  readonly declaration: BundleDeclaration
}

export interface KernelAppIncompatibility {
  readonly app: string
  readonly reason: Incompatibility
}

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
