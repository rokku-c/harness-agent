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

export const unhonouredKind = (filter: ActivityFilter): string | undefined =>
  all(filter.kind) ? undefined : filter.kind
