/**
 * groups/backend.ts - the GROUP BACKEND (service layer).
 *
 * Concept: an in-memory discussion log keyed by group uri. A group's members
 * are child ids; the backend itself only records and reads the log - posting
 * and cross-agent delivery are composed by the caller (see groups/ops.ts),
 * not baked in here.
 */
import { Effect, Layer, Ref } from "effect"
import {
  AgentFailure, eaUri, Groups, groupPost, groupRead, makeGroup, Uri, type GroupRef
} from "@effect-agent/core"

export const GroupsLayer = Layer.effect(Groups, Effect.gen(function* () {
  const groups = yield* Ref.make<ReadonlyMap<string, GroupRef>>(new Map())
  const groupUri = (uriOrName: string) => (Uri.isEa(uriOrName) ? uriOrName : eaUri("group", uriOrName))
  const known = (map: ReadonlyMap<string, GroupRef>) => [...map.keys()].join(", ")
  const missing = (map: ReadonlyMap<string, GroupRef>, group: string) =>
    new AgentFailure({ agent: "runtime", cause: "unknown group: " + group + " (known: " + known(map) + ")" })

  return {
    create: (name, children) =>
      Effect.gen(function* () {
        const group = yield* makeGroup(name, children)
        yield* Ref.update(groups, (map) => new Map(map).set(group.uri, group))
        return group.uri
      }),
    post: (group, author, text) =>
      Effect.gen(function* () {
        const map = yield* Ref.get(groups)
        const found = map.get(groupUri(group))
        if (found === undefined) return yield* missing(map, group)
        yield* groupPost(found, author, text)
      }),
    read: (group, limit) =>
      Effect.gen(function* () {
        const map = yield* Ref.get(groups)
        const found = map.get(groupUri(group))
        if (found === undefined) return yield* missing(map, group)
        return yield* groupRead(found, limit)
      }),
    members: (group) =>
      Effect.gen(function* () {
        const map = yield* Ref.get(groups)
        const found = map.get(groupUri(group))
        if (found === undefined) return yield* missing(map, group)
        return yield* Ref.get(found.members)
      })
  }
}))
