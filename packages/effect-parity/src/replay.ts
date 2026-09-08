/**
 * Replay — turn an observation snapshot back into an interactive parity view.
 *
 * A snapshot is a frozen frame of one perspective; re-presenting it keeps the
 * observed state (so the human opens on exactly what was captured) while the
 * action set stays live for acting again. The snapshot type is declared here
 * structurally because @effect-agent/effect-observe is not yet a workspace
 * package: once it lands, replace this local ObservationSnapshot with a
 * type-only import from it — the function body is unchanged.
 */

import type { ParityAppView } from "./types.ts"

/** Structural shape of effect-observe's ObservationSnapshot. */
export interface ObservationSnapshot {
  readonly id?: string
  readonly capturedAt?: number
  /** the observed frame, already ParityAppView-shaped */
  readonly data: ParityAppView
}

export const parityFromSnapshot = (snapshot: ObservationSnapshot): ParityAppView => ({
  ns: snapshot.data.ns,
  appId: snapshot.data.appId,
  view: snapshot.data.view,
  state: snapshot.data.state,
  actions: snapshot.data.actions,
})
