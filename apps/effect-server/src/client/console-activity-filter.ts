/**
 * The record's filters, applied where the record has the field to apply them to.
 *
 * H9 names four: actor, app, kind, since. The host record as it stands is a
 * stream of frames carrying `perspective`, `target`, `at` and a failure — so
 * there is a real field behind three of them and none behind the fourth:
 *
 *   * **actor** — `perspective` is the only field that says who raised a frame,
 *     and it answers `agent` or something an app or the host itself raised.
 *     `human` therefore matches nothing today: no frame is raised by a hand.
 *     §9.4 is the mechanism that puts a real actor on every record and replaces
 *     this mapping; until it lands, the filter narrows the field that exists
 *     rather than pretending to a field that does not.
 *   * **app** — `target`, which is the app a frame is about.
 *   * **since** — `at`, which is a timestamp a cursor can genuinely cut on.
 *   * **kind** — nothing. The record has no kind, and inventing one here would
 *     put a second vocabulary beside the one §9.4 is going to write. The address
 *     keeps it and the surface says it is not applied.
 */

import type { ActivityObservation } from "./console-activity.ts"
import type { ActivityFilter } from "./console-route.ts"

export const ACTORS = ["all", "human", "agent", "system"] as const

export const actorOf = (observation: ActivityObservation): string =>
  observation.perspective === "agent" ? "agent" : "system"

const all = (value: string | undefined): boolean => value === undefined || value === "" || value === "all"

const sinceOf = (filter: ActivityFilter): number | undefined => {
  if (filter.since === undefined || filter.since === "") return undefined
  const value = Number(filter.since)
  return Number.isFinite(value) ? value : undefined
}

export const applyFilter = (observations: readonly ActivityObservation[], filter: ActivityFilter): readonly ActivityObservation[] => {
  const since = sinceOf(filter)
  return observations.filter((observation) =>
    (all(filter.actor) || actorOf(observation) === filter.actor) &&
    (all(filter.app) || observation.target === filter.app) &&
    (since === undefined || observation.at >= since))
}

/** The filter the address carries that the record cannot answer, named so the surface can say so (§2.H9). */
export const unhonouredKind = (filter: ActivityFilter): string | undefined =>
  all(filter.kind) ? undefined : filter.kind
