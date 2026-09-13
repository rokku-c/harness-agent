/**
 * What the supervisor announces as it goes: the receipt trail for a boot, a swap
 * or a rebuild.
 *
 * A host that wants a line per decision subscribes here; nothing in the state
 * machine depends on anyone listening, so an event that nobody reads costs a
 * `?.` and nothing more.
 */
import type { KernelAppIncompatibility } from "./kernel-matrix.ts"
import type { KernelRevision } from "./repo.ts"

export type SupervisorEvent =
  | { readonly kind: "booted"; readonly revision: KernelRevision }
  | { readonly kind: "fell-back"; readonly from: KernelRevision; readonly to: KernelRevision; readonly reason: string }
  | { readonly kind: "staged"; readonly revision: KernelRevision }
  | { readonly kind: "rejected"; readonly revision: KernelRevision; readonly reason: string }
  | { readonly kind: "swapped"; readonly from: KernelRevision | undefined; readonly to: KernelRevision }
  | { readonly kind: "rebuilding"; readonly revision: KernelRevision; readonly broken: readonly KernelAppIncompatibility[] }
  | { readonly kind: "rebuilt"; readonly from: KernelRevision; readonly to: KernelRevision }
  /** A ② attempt that did not restore the app layer. `restored: false` = restart needed. */
  | { readonly kind: "rebuild-failed"; readonly revision: KernelRevision; readonly reason: string; readonly restored: boolean }
