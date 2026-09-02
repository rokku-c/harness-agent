/**
 * Groups: a discussion-log backend plus its op factories. A group's members
 * are child ids; posting logs the message and delivers it into every
 * member's signal box through the runtime's public send - delivery is
 * composed here, not baked into the backend.
 */
import { Effect, Layer, Option, Ref, Schema } from "effect"
import {
  AgentFailure, AgentRuntime, AgentSession, eaUri, Groups, groupPost, groupRead,
  makeGroup, notationText, Op, Uri, type GroupRef
} from "@effect-agent/core"

export const GroupsLayer = Layer.effect(Groups, Effect.gen(function* () {
  const groups = yield* Ref.make<ReadonlyMap<string, GroupRef>>(new Map())
  const groupUri = (uriOrName: string) => (Uri.isEa(uriOrName) ? uriOrName : eaUri("group", uriOrName))
  const known = (map: ReadonlyMap<string, GroupRef>) => [...map.keys()].join(", ")

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
        if (found === undefined)
          return yield* new AgentFailure({ agent: "runtime", cause: "unknown group: " + group + " (known: " + known(map) + ")" })
        yield* groupPost(found, author, text)
      }),
    read: (group, limit) =>
      Effect.gen(function* () {
        const map = yield* Ref.get(groups)
        const found = map.get(groupUri(group))
        if (found === undefined)
          return yield* new AgentFailure({ agent: "runtime", cause: "unknown group: " + group + " (known: " + known(map) + ")" })
        return yield* groupRead(found, limit)
      }),
    members: (group) =>
      Effect.gen(function* () {
        const map = yield* Ref.get(groups)
        const found = map.get(groupUri(group))
        if (found === undefined)
          return yield* new AgentFailure({ agent: "runtime", cause: "unknown group: " + group + " (known: " + known(map) + ")" })
        return yield* Ref.get(found.members)
      })
  }
}))

const authorOf = Effect.map(Effect.serviceOption(AgentSession), (session) =>
  Option.isSome(session) ? session.value.agent : "agent"
)

export const groupOps = () => [
  Op.write({
    name: "create_group",
    description: notationText("Create a discussion group over child ids; posts reach members between their steps."),
    input: Schema.Struct({ name: Schema.String, children: Schema.Array(Schema.String) }),
    output: Schema.Struct({ uri: Schema.String }),
    execute: (input: unknown) =>
      Effect.flatMap(Groups, (groups) => {
        const { name, children } = input as { name: string; children: ReadonlyArray<string> }
        return Effect.map(groups.create(name, children), (uri) => ({ uri }))
      })
  }),
  Op.write({
    name: "post_group",
    description: notationText("Post to a group discussion; members see it between their steps."),
    input: Schema.Struct({ group: Schema.String, text: Schema.String }),
    output: Schema.Struct({ posted: Schema.Boolean }),
    execute: (input: unknown) =>
      Effect.gen(function* () {
        const groups = yield* Groups
        const runtime = yield* AgentRuntime
        const author = yield* authorOf
        const { group, text } = input as { group: string; text: string }
        yield* groups.post(group, author, text)
        // delivery through the runtime's public send: every member sees the
        // post at its next step boundary
        const members = yield* groups.members(group)
        yield* Effect.forEach(
          members,
          (member) => Effect.ignore(runtime.send(member, { _tag: "Inject", content: [{ _tag: "Text", text: "[group " + group + "] " + author + ": " + text }] })),
          { discard: true }
        )
        return { posted: true }
      })
  }),
  Op.read({
    name: "read_group",
    description: notationText("Read the group's discussion log."),
    input: Schema.Struct({ group: Schema.String, limit: Schema.optional(Schema.Number) }),
    output: Schema.Unknown,
    execute: (input: unknown) =>
      Effect.flatMap(Groups, (groups) => {
        const { group, limit } = input as { group: string; limit?: number }
        return groups.read(group, limit)
      })
  })
]

