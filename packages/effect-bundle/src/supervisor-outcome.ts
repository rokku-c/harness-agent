import type { KernelAppIncompatibility } from "./kernel-matrix.ts"
import type { KernelRevision } from "./repo.ts"
import type { Incompatibility } from "./compat-verdict.ts"

export interface KernelSlot<K> {
  readonly revision: KernelRevision
  readonly kernel: K
  dispose(): Promise<void>
}

export type Refusal =
  | { readonly kind: "incompatible"; readonly reason: Incompatibility }
  | { readonly kind: "apps"; readonly broken: readonly KernelAppIncompatibility[] }

export const describeRefusal = (refusal: Refusal): string =>
  refusal.kind === "incompatible"
    ? refusal.reason.message
    : `would break ${refusal.broken.length} loaded app(s): ` +
      refusal.broken.map((entry) => `${entry.app} (${entry.reason.message})`).join("; ")

export type StageResult<K> =
  | { readonly ok: true; readonly slot: KernelSlot<K> }
  | { readonly ok: false; readonly reason: "incompatible" | "apps-incompatible"; readonly refusal: Refusal }
  | { readonly ok: false; readonly reason: "failed"; readonly error: unknown }

export type BootResult<K> = {
  readonly ok: true
  readonly slot: KernelSlot<K>
  readonly fellBack?: { readonly from: KernelRevision; readonly reason: string }
}
