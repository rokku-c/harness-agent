/** board/reads.ts - SNAPSHOT + VIEW READS.
 *  Concept: state() renders the whole snapshot (resource usage counted from
 *  governor holdings), viewItems() projects one declared view's columns by
 *  state (+ optional label filter), ordered oldest first. */
import { Effect, Ref } from "effect"
import type { Tables } from "../store.ts"
import type { ResourceGovernor } from "../governor.ts"
import type { EventBus } from "../events.ts"
import type { BoardApi, BoardDeps } from "./contract.ts"
import type { WorkItem } from "../domain.ts"
import { rollup } from "../domain/rollup.ts"

export const readsSlice = (deps: BoardDeps): Pick<BoardApi, "tables" | "bus" | "governor" | "state" | "getItem" | "listItems" | "viewItems" | "eventsAfter"> => {
  const { tables, bus, governor } = deps
  return {
    tables,
    bus,
    governor,
    state: () =>
      Effect.gen(function* () {
        const resources = [...(yield* Ref.get(tables.resources)).values()]
        const items = [...(yield* Ref.get(tables.items)).values()].sort((a, b) => b.createdAt - a.createdAt)
        const executors = [...(yield* Ref.get(tables.executors)).values()]
        const agents = [...(yield* Ref.get(tables.agents)).values()]
        const views = yield* Ref.get(tables.views)
        const holdings = yield* governor.holdings()
        const usedOf = (resourceId: string): number => {
          const held = holdings.held.get(resourceId)
          return held === undefined ? 0 : [...held.values()].reduce((a, b) => a + b, 0)
        }
        return {
          resources: resources.map((r) => ({ resourceId: r.resourceId, name: r.name, kind: r.kind, capacity: r.capacity, concurrency: r.concurrency, used: usedOf(r.resourceId) })),
          items,
          executors: executors.map((e) => ({ executorId: e.executorId, name: e.name, kind: e.kind, status: e.status, capability: e.capability })), agents,
          views: views.map((v) => ({ name: v.name, columns: v.columns.map((c) => ({ id: c.id, title: c.title, states: [...c.states] })) }))
        }
      }),
    getItem: (itemId) => Ref.get(tables.items).pipe(Effect.map((m) => m.get(itemId))),
    listItems: () => Ref.get(tables.items).pipe(Effect.map((m) => [...m.values()])),
    tree: (nodeId, depth = Number.POSITIVE_INFINITY) => Effect.gen(function* () {
      const items = yield* Ref.get(tables.items)
      const root = nodeId === undefined ? [...items.values()].find((item) => item.parentId === undefined) : items.get(nodeId)
      if (!root) return { ok: false, nodes: [], detail: "node not found" }
      const nodes: WorkItem[] = []
      const visit = (id: string, level: number): void => {
        const item = items.get(id)
        if (!item || level > depth) return
        nodes.push(item)
        if (level < depth) item.children.forEach((child) => visit(child, level + 1))
      }
      visit(root.itemId, 0)
      return { ok: true, root, nodes, summary: rollup(items, root.itemId) }
    }),
    viewItems: (viewName) =>
      Effect.gen(function* () {
        const views = yield* Ref.get(tables.views)
        const view = views.find((v) => v.name === viewName) ?? views[0]
        if (view === undefined) return { view: { name: "", columns: [] } }
        const items = [...(yield* Ref.get(tables.items)).values()]
        return {
          view: {
            name: view.name,
            columns: view.columns.map((c) => ({
              id: c.id,
              title: c.title,
              states: [...c.states],
              itemIds: items
                .filter((item) => c.states.includes(item.state) && (c.label === undefined || item.labels.includes(c.label)))
                .sort((a, b) => a.createdAt - b.createdAt)
                .map((i) => i.itemId)
            }))
          }
        }
      }),
    eventsAfter: (ts) => bus.after(ts).pipe(Effect.map((events) => events.map((e) => ({ ...e }))))
  }
}
