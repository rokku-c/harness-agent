import { Context, Effect, Ref } from "effect"
import type { AgentError } from "./errors.ts"
import { eaUri } from "./uri.ts"

/**
 * Coordination structures as pure data. A Board is a versioned whiteboard;
 * a Group is a discussion log whose posts reach its members between their
 * steps. Both surface as ordinary Bindings - an agent shares them with
 * children by granting access, not by special-casing a harness layer.
 *
 * The service SHAPES live here (they are part of the vocabulary the runtime
 * hands its children); the Ref-backed implementations live in builtin.
 */
export interface BoardEntry {
  readonly seq: number
  readonly author: string
  readonly text: string
}

export interface GroupEntry {
  readonly author: string
  readonly text: string
}

export interface BoardRef {
  readonly uri: string
  readonly entries: Ref.Ref<ReadonlyArray<BoardEntry>>
}

export const makeBoard = (name: string): Effect.Effect<BoardRef> =>
  Effect.gen(function* () {
    const entries = yield* Ref.make<ReadonlyArray<BoardEntry>>([])
    return { uri: eaUri("board", name), entries }
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
  /** Members are child ids; delivery into their signal boxes is wiring. */
  readonly members: Ref.Ref<ReadonlyArray<string>>
}

export const makeGroup = (name: string, children: ReadonlyArray<string>): Effect.Effect<GroupRef> =>
  Effect.gen(function* () {
    const log = yield* Ref.make<ReadonlyArray<GroupEntry>>([])
    const members = Ref.unsafeMake(children)
    return { uri: eaUri("group", name), log, members }
  })

export const groupPost = (group: GroupRef, author: string, text: string) =>
  Ref.update(group.log, (current) => [...current, { author, text }])

export const groupRead = (group: GroupRef, limit?: number) =>
  Effect.gen(function* () {
    const all = yield* Ref.get(group.log)
    return limit === undefined ? all : all.slice(-limit)
  })

/** The board surface an agent's coordination ops talk to. */
export interface BoardsService {
  readonly create: (name: string) => Effect.Effect<string, AgentError>
  readonly post: (board: string, author: string, text: string) => Effect.Effect<void, AgentError>
  readonly read: (board: string) => Effect.Effect<ReadonlyArray<BoardEntry>, AgentError>
}

export class Boards extends Context.Tag("core/Boards")<Boards, BoardsService>() {}

/** The group surface: create over child ids, post, read the log. */
export interface GroupsService {
  readonly create: (name: string, children: ReadonlyArray<string>) => Effect.Effect<string, AgentError>
  readonly post: (group: string, author: string, text: string) => Effect.Effect<void, AgentError>
  readonly read: (group: string, limit?: number) => Effect.Effect<ReadonlyArray<GroupEntry>, AgentError>
  readonly members: (group: string) => Effect.Effect<ReadonlyArray<string>, AgentError>
}

export class Groups extends Context.Tag("core/Groups")<Groups, GroupsService>() {}

