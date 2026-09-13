/**
 * Where a set and a binding live, and the seam that carries them.
 *
 * A set is declared in the center that configures machines and enforced at the
 * door. Those are two apps in one host and one fact between them, so this file
 * is the seam and not a copy: the center hands over a *reader* — a closure over
 * its own state — and whoever needs the facts asks for them at the moment it
 * needs them. There is no instant at which two stores could disagree, and
 * nothing to keep in step.
 *
 * `revision` is the center's own write counter, the one its receipts are
 * measured against. Facts at one revision are the facts at that revision, so a
 * reader that has already built what it needs has built it for every write
 * below that number — and no write below it can have changed a set or a
 * binding, because every one of those bumps it (`Formal/SetSource.lean`).
 *
 * One app fills the slot, and the slot holds it to that. A fact with two
 * writers is the defect this file exists to remove, so a second provider is
 * refused rather than allowed to overwrite. A reload is not a second provider:
 * it is the same app saying the same thing again with a newer reader, which is
 * exactly what replacing it means.
 */
import type { McpSet, McpSetBinding } from "./contract-sets.ts"

/** The declarations as of one write: what the center holds, at the revision it held them. */
export interface McpSetFacts {
  readonly revision: number
  readonly sets: readonly McpSet[]
  readonly bindings: readonly McpSetBinding[]
}

/** The center's own state, read as a value. One writer; a reader may ask at any time. */
export interface McpSetSource { facts(): McpSetFacts }

/**
 * The seam every app is handed: the center says where the sets live, and the
 * door reads where they were said to live. Both halves are on one object
 * because they are one question — a slot nobody filled has no facts, and that
 * is a state a reader must be able to see rather than one it may assume away.
 */
export interface McpSetSlot {
  /** Declare where the sets are held. Refused if another app already said so. */
  provide(provider: string, source: McpSetSource): void
  source(): McpSetSource | undefined
}

export const makeMcpSetSlot = (): McpSetSlot => {
  let held: { readonly provider: string; readonly source: McpSetSource } | undefined
  return {
    provide: (provider, source) => {
      if (held !== undefined && held.provider !== provider) {
        throw new Error(`the MCP sets are ${held.provider}'s to declare; ${provider} cannot take them`)
      }
      held = { provider, source }
    },
    source: () => held?.source,
  }
}
