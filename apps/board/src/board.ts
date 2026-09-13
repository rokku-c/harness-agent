import { makeDocumentService } from "./docs/service.ts"
import { makeDocStore } from "./docs/store.ts"
import { makeRuns } from "./runs/service.ts"
import { makeRunStore } from "./runs/store.ts"
import { openBoardDatabase, type StorePolicy } from "./storage/database.ts"
import { makeTaskStore } from "./storage/store.ts"
import { makeTaskMutations } from "./tasks/mutations.ts"
import { rollupForest, rollupTree } from "./tasks/rollup.ts"
import { taskTable } from "./tasks/table.ts"
import { states } from "./tasks/schema.ts"

/**
 * SQLite mutations and events commit together; no cached snapshot or resource
 * scheduler. Board records what agents declare about their runs, derives every
 * parent state from the leaves below it, and keeps outlines as documents that
 * collaborators edit one operation at a time. Scheduling and machine access
 * belong to the agentd center, so an intent to run something never lands here.
 */
export const makeBoard = (
  { dataFile = ":memory:", incompatibleStore = "clean" }: { dataFile?: string; incompatibleStore?: StorePolicy } = {}
) => {
  const db = openBoardDatabase(dataFile, incompatibleStore)
  const store = makeTaskStore(db), runStore = makeRunStore(db), docStore = makeDocStore(db)
  // a run still marked running when board starts has no live agent behind it
  runStore.orphanRunning()
  const runs = makeRuns(store, runStore), tasks = makeTaskMutations(store), docs = makeDocumentService(store, docStore)
  const tree = () => ({ roots: rollupForest(store.list(), runStore.runs()) })
  return {
    list: store.list, get: tasks.get, create: tasks.create, update: tasks.update, delete: tasks.delete,
    events: store.events, recentEvents: store.recentEvents, close: store.close,
    announce: runs.announce, start: runs.start, progress: runs.progress, finish: runs.finish,
    agents: runs.agents, runs: runs.runs,
    docList: docs.list, docGet: docs.get, docCreate: docs.create, docApply: docs.apply, docDelete: docs.delete,
    /** a hello: announce, and receive the board just joined in one round trip */
    sync: (input: unknown) => ({ agent: runs.announce(input), agents: runs.agents(), ...tree() }),
    tree,
    /** the same tasks as rows: a projection, so nothing here is stored twice */
    table: (columns?: readonly string[]) => taskTable(store.list(), runStore.runs(), columns),
    state: () => {
      const all = store.list(), derived = rollupTree(all, runStore.runs())
      // `rollup` stays a separate field: a parent's own `state` is what an
      // operator set and may legitimately differ from what its children make it
      const resolved = all.map((task) => ({ ...task, rollup: derived.get(task.id) }))
      return {
        tasks: resolved,
        counts: Object.fromEntries(states.map((state) => [state, resolved.filter((task) => task.rollup?.state === state).length])),
      }
    },
  }
}
export type BoardApi = ReturnType<typeof makeBoard>
