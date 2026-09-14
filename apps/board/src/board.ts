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

export const makeBoard = (
  { dataFile = ":memory:", incompatibleStore = "clean" }: { dataFile?: string; incompatibleStore?: StorePolicy } = {}
) => {
  const db = openBoardDatabase(dataFile, incompatibleStore)
  const store = makeTaskStore(db), runStore = makeRunStore(db), docStore = makeDocStore(db)
  runStore.orphanRunning()
  const runs = makeRuns(store, runStore), tasks = makeTaskMutations(store), docs = makeDocumentService(store, docStore)
  const tree = () => ({ roots: rollupForest(store.list(), runStore.runs()) })
  return {
    list: store.list, get: tasks.get, create: tasks.create, update: tasks.update, delete: tasks.delete,
    events: store.events, recentEvents: store.recentEvents, close: store.close,
    announce: runs.announce, start: runs.start, progress: runs.progress, finish: runs.finish,
    agents: runs.agents, runs: runs.runs,
    docList: docs.list, docGet: docs.get, docCreate: docs.create, docApply: docs.apply, docDelete: docs.delete,
    sync: (input: unknown) => ({ agent: runs.announce(input), agents: runs.agents(), ...tree() }),
    tree,
    table: (columns?: readonly string[]) => taskTable(store.list(), runStore.runs(), columns),
    state: () => {
      const all = store.list(), derived = rollupTree(all, runStore.runs())
      const resolved = all.map((task) => ({ ...task, rollup: derived.get(task.id) }))
      return {
        tasks: resolved,
        counts: Object.fromEntries(states.map((state) => [state, resolved.filter((task) => task.rollup?.state === state).length])),
      }
    },
  }
}
export type BoardApi = ReturnType<typeof makeBoard>
