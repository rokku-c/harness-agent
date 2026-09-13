/**
 * What a boot or a stage hands back: the slot that is in front, the fallback it
 * landed on, and the refusal that stopped it.
 *
 * The kernel is generic (`K`) — this state machine is about revisions and
 * pointers, not about what a kernel is — so a slot carries the revision it was
 * loaded from and the injected means to stop it, and nothing else.
 */
import type { KernelAppIncompatibility } from "./kernel-matrix.ts"
import type { KernelRevision } from "./repo.ts"
import type { Incompatibility } from "./compat-verdict.ts"

/** One loaded kernel revision, and the means to stop it. */
export interface KernelSlot<K> {
  readonly revision: KernelRevision
  readonly kernel: K
  dispose(): Promise<void>
}

/** Why a revision may not run here. Both halves of §5, kept distinguishable. */
export type Refusal =
  | { readonly kind: "incompatible"; readonly reason: Incompatibility }
  | { readonly kind: "apps"; readonly broken: readonly KernelAppIncompatibility[] }

export const describeRefusal = (refusal: Refusal): string =>
  refusal.kind === "incompatible"
    ? refusal.reason.message
    : `would break ${refusal.broken.length} loaded app(s): ` +
      refusal.broken.map((entry) => `${entry.app} (${entry.reason.message})`).join("; ")

/** A thrown unknown as the readable reason a result, an event or a log line carries. */
export const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export type StageResult<K> =
  | { readonly ok: true; readonly slot: KernelSlot<K> }
  | { readonly ok: false; readonly reason: "incompatible" | "apps-incompatible"; readonly refusal: Refusal }
  | { readonly ok: false; readonly reason: "failed"; readonly error: unknown }

export type BootResult<K> = {
  readonly ok: true
  readonly slot: KernelSlot<K>
  /** Present when the recorded active revision could not be loaded (§6.5-4). */
  readonly fellBack?: { readonly from: KernelRevision; readonly reason: string }
}
