import { Effect, Ref } from "effect"
import type { Binding, BoardEntry, GroupEntry } from "./index.ts"

/**
 * Coordination structures as pure data. A Board is a versioned whiteboard;
 * a Group is a discussion log that pushes into its members' signal boxes.
 * Both surface as ordinary Bindings - an agent shares them with children by
 * granting access, not by special-casing a harness layer.
 */
export interface BoardRef {
  readonly uri: string
  readonly entries: Ref.Ref<ReadonlyArray<BoardEntry>>
}

export const makeBoard = (name: string): Effect.Effect<BoardRef> =>
  Effect.gen(function* () {
    const entries = yield* Ref.make<ReadonlyArray<BoardEntry>>([])
    return { uri: "ea://board/" + name, entries }
  })

export const boardPost = (board: BoardRef, author: string, text: string) =>
  Ref.update(board.entries, (current) => [
    ...current,
    { seq: current.length + 1, author, text }
  ])

export const boardRead = (board: BoardRef) => Ref.get(board.entries)

export interface GroupRef {
  readonly uri: string
  readonly log: Ref.Ref<ReadonlyArray<GroupEntry>>
  /** Members are child ids; the runtime wires pushes to their signal boxes. */
  readonly members: Ref.Ref<ReadonlyArray<string>>
}

export const makeGroup = (name: string, children: ReadonlyArray<string>): Effect.Effect<GroupRef> =>
  Effect.gen(function* () {
    const log = yield* Ref.make<ReadonlyArray<GroupEntry>>([])
    const members = yield* Ref.make(children)
    return { uri: "ea://group/" + name, log, members }
  })

export const groupPost = (group: GroupRef, author: string, text: string) =>
  Ref.update(group.log, (current) => [...current, { author, text }])

export const groupRead = (group: GroupRef, limit?: number) =>
  Effect.gen(function* () {
    const all = yield* Ref.get(group.log)
    return limit === undefined ? all : all.slice(-limit)
  })

