/** board/item-create.ts - createItem + parent linkage.
 *  Concept: new items land in todo; a parentId appends the child id to the
 *  parent's children list (unknown parent = item still created alone). */
import { Effect, Ref } from "effect"
import type { Tables } from "../store.ts"
import type { WorkItem } from "../domain.ts"
import type { BoardApi } from "./contract.ts"
import type { BoardCtx } from "./context.ts"
import { PRIORITY_OF, newItemId } from "./rules.ts"

export const createItemSlice = (ctx: BoardCtx): Pick<BoardApi, "createItem"> => {
  const { tables, bus, save } = ctx
  return {
    createItem: (input) =>
      Effect.gen(function* () {
        const id = newItemId(input.title)
        const now = Date.now()
        const item: WorkItem = {
          itemId: id,
          title: input.title,
          body: input.body,
          state: "todo",
          priority: PRIORITY_OF(input.priority ?? "normal"),
          assigneeId: input.assigneeId,
          requires: input.requires?.map((r) => ({ resourceId: r.resourceId, amount: r.amount })),
          parentId: input.parentId,
          dependencies: input.dependencies ?? [],
          children: [],
          labels: input.labels ?? [],
          blockedReason: undefined,
          result: undefined,
          createdAt: now,
          updatedAt: now
        }
        yield* Ref.update(tables.items, (m) => new Map(m).set(id, item))
        const parentId = input.parentId
        if (parentId !== undefined)
          yield* Ref.update(tables.items, (m) => {
            const parent = m.get(parentId)
            if (parent === undefined) return m
            return new Map(m).set(parentId, { ...parent, children: [...parent.children, id], updatedAt: Date.now() })
          })
        yield* bus.push({ type: "item.created", itemId: id, message: input.title })
        yield* save()
        return { itemId: id }
      })
  }
}
