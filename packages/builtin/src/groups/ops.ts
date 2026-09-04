/**
 * groups/ops.ts - the GROUP OP SURFACE (what an agent can do).
 *
 * Concept: express the backend as effect-agent ops (create/post/read).
 * Delivery is composed HERE, on the op layer: posting a message also pushes
 * it into every member's signal box through the runtime's public send, so
 * members see it at their next step boundary.
 */
import { Effect, Option, Schema } from "effect"
import {
  AgentRuntime, AgentSession, Groups, notationText, Op
} from "@effect-agent/core"

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
