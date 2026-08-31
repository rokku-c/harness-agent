/**
 * Boards: a shared whiteboard backend over the pure core structures, plus
 * the op factories that surface them as an ordinary binding. An agent that
 * includes board ops can share findings with any child it spawns.
 */
import { Effect, Layer, Option, Ref, Schema } from "effect"
import {
  AgentFailure, AgentSession, Boards, boardPost, boardRead, makeBoard,
  notationText, Op, type BoardRef
} from "@effect-agent/core"

export const BoardsLayer = Layer.effect(Boards, Effect.gen(function* () {
  const boards = yield* Ref.make<ReadonlyMap<string, BoardRef>>(new Map())
  const boardUri = (uriOrName: string) => (uriOrName.startsWith("ea://") ? uriOrName : "ea://board/" + uriOrName)
  const known = (map: ReadonlyMap<string, BoardRef>) => [...map.keys()].join(", ")

  return {
    create: (name) =>
      Effect.gen(function* () {
        const board = yield* makeBoard(name)
        yield* Ref.update(boards, (map) => new Map(map).set(board.uri, board))
        return board.uri
      }),
    post: (board, author, text) =>
      Effect.gen(function* () {
        const map = yield* Ref.get(boards)
        const found = map.get(boardUri(board))
        if (found === undefined)
          return yield* new AgentFailure({ agent: "runtime", cause: "unknown board: " + board + " (known: " + known(map) + ")" })
        yield* boardPost(found, author, text)
      }),
    read: (board) =>
      Effect.gen(function* () {
        const map = yield* Ref.get(boards)
        const found = map.get(boardUri(board))
        if (found === undefined)
          return yield* new AgentFailure({ agent: "runtime", cause: "unknown board: " + board + " (known: " + known(map) + ")" })
        return yield* boardRead(found)
      })
  }
}))

const authorOf = Effect.map(Effect.serviceOption(AgentSession), (session) =>
  Option.isSome(session) ? session.value.agent : "agent"
)

export const boardOps = () => [
  Op.write({
    name: "create_board",
    description: notationText("Create a shared whiteboard; the returned uri grants read/write access to any child you spawn."),
    input: Schema.Struct({ name: Schema.String }),
    output: Schema.Struct({ uri: Schema.String }),
    execute: (input: unknown) =>
      Effect.flatMap(Boards, (boards) => Effect.map(boards.create((input as { name: string }).name), (uri) => ({ uri })))
  }),
  Op.write({
    name: "post_board",
    description: notationText("Append a finding to a shared whiteboard."),
    input: Schema.Struct({ board: Schema.String, text: Schema.String }),
    output: Schema.Struct({ posted: Schema.Boolean }),
    execute: (input: unknown) =>
      Effect.gen(function* () {
        const boards = yield* Boards
        const author = yield* authorOf
        const { board, text } = input as { board: string; text: string }
        yield* boards.post(board, author, text)
        return { posted: true }
      })
  }),
  Op.read({
    name: "read_board",
    description: notationText("Read every entry on a shared whiteboard."),
    input: Schema.Struct({ board: Schema.String }),
    output: Schema.Unknown,
    execute: (input: unknown) => Effect.flatMap(Boards, (boards) => boards.read((input as { board: string }).board))
  })
]

