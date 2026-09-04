/**
 * Board tables: resources, work items, executors and views live in Ref-backed
 * maps (single process). Mutations run through Effect; when BOARD_DATA_FILE
 * is set every mutation is persisted as a full JSON snapshot, so the board
 * survives restarts without a database.
 */
import { Effect, Ref } from "effect"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import type { BoardView, Executor, Resource, WorkItem } from "./domain.ts"

export interface Tables {
  readonly items: Ref.Ref<ReadonlyMap<string, WorkItem>>
  readonly resources: Ref.Ref<ReadonlyMap<string, Resource>>
  readonly executors: Ref.Ref<ReadonlyMap<string, Executor>>
  readonly views: Ref.Ref<ReadonlyArray<BoardView>>
}

const DEFAULT_VIEW: BoardView = {
  name: "board",
  columns: [
    { id: "todo", title: "Todo", states: ["todo", "ready"], label: undefined },
    { id: "doing", title: "Doing", states: ["doing"], label: undefined },
    { id: "blocked", title: "Blocked", states: ["blocked"], label: undefined },
    { id: "done", title: "Done", states: ["done", "failed"], label: undefined },
    { id: "cancelled", title: "Cancelled", states: ["cancelled"], label: undefined }
  ]
}

interface Snapshot {
  readonly items?: unknown[]
  readonly resources?: unknown[]
  readonly executors?: unknown[]
}

const loadSnapshot = (file: string | undefined): Snapshot => {
  if (file === undefined || !existsSync(file)) return {}
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as Snapshot
  } catch {
    return {}
  }
}

const byIdRows = (rows: unknown[] | undefined, key: string): ReadonlyArray<readonly [string, unknown]> =>
  (rows ?? []).map((row) => {
    const item = row as Record<string, unknown>
    return [String(item[key]), item] as const
  })

export const makeTables = (file?: string): Effect.Effect<Tables> =>
  Effect.gen(function* () {
    const snap = loadSnapshot(file)
    const items = yield* Ref.make<ReadonlyMap<string, WorkItem>>(
      new Map<string, WorkItem>(byIdRows(snap.items, "itemId") as Iterable<readonly [string, WorkItem]>)
    )
    const resources = yield* Ref.make<ReadonlyMap<string, Resource>>(
      new Map<string, Resource>(byIdRows(snap.resources, "resourceId") as Iterable<readonly [string, Resource]>)
    )
    const executors = yield* Ref.make<ReadonlyMap<string, Executor>>(
      new Map<string, Executor>(byIdRows(snap.executors, "executorId") as Iterable<readonly [string, Executor]>)
    )
    const views = yield* Ref.make<ReadonlyArray<BoardView>>([DEFAULT_VIEW])
    return { items, resources, executors, views }
  })

const saveSnapshot = (file: string | undefined, tables: Tables): Effect.Effect<void> => {
  if (file === undefined) return Effect.void
  return Effect.gen(function* () {
    const items = [...(yield* Ref.get(tables.items)).values()]
    const resources = [...(yield* Ref.get(tables.resources)).values()]
    const executors = [...(yield* Ref.get(tables.executors)).values()]
    writeFileSync(file, JSON.stringify({ items, resources, executors }, null, 2) + "\n", "utf-8")
  })
}

/** persist a full snapshot when a data file is configured (fire and forget) */
export const persist = (file: string | undefined, tables: Tables): Effect.Effect<void> => saveSnapshot(file, tables)

export const DEFAULT_VIEW_REF = DEFAULT_VIEW
