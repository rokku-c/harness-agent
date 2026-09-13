/**
 * Replay — read a recorded observation frame back as an interactive parity view.
 *
 * The monitor plane records the parity view it serves live, so a frame the agent
 * perspective holds IS a parity view, and reading one back keeps the observed
 * state: the human opens on exactly what was captured, while the action set
 * stays live for acting again.
 *
 * The frame is `effect-observe`'s, which is what the store writes — `at`,
 * `perspective`, `target`, and `data` as whatever the sampler returned. Only a
 * frame that really holds a parity view reads as one: `data` is untyped, so
 * anything else reads as nothing, where reading its fields anyway hands back a
 * view with no state that renders as an app with nothing in it. The fields a
 * frame is filed under — when, from where, about what — are not read here at
 * all; the view is the frame's own.
 */

import type { ObservationSnapshot } from "@effect-agent/effect-observe"
import type { ParityAppView } from "./types.ts"

/** Whether a sampler's reading is a parity view: the names it is filed under and
 *  the actions the human is offered. */
const isParityView = (data: unknown): data is ParityAppView => {
  if (typeof data !== "object" || data === null) return false
  const view = data as Partial<ParityAppView>
  return typeof view.ns === "string" && typeof view.appId === "string" && Array.isArray(view.actions)
}

export const parityFromSnapshot = (snapshot: ObservationSnapshot): ParityAppView | undefined => {
  const data = snapshot.data
  return isParityView(data) ? data : undefined
}
