import type { WorkItem } from "./work.ts"

export class TreeInvariantError extends Error {}

export const isLeaf = (item: WorkItem): boolean => (item.kind ?? "leaf") === "leaf"

export const assertParent = (items: ReadonlyMap<string, WorkItem>, child: WorkItem): void => {
  if (child.parentId === undefined) return
  if (child.parentId === child.itemId) throw new TreeInvariantError("node cannot parent itself")
  const seen = new Set<string>([child.itemId])
  let cursor: string | undefined = child.parentId
  while (cursor !== undefined) {
    if (seen.has(cursor)) throw new TreeInvariantError("tree cycle detected")
    seen.add(cursor)
    cursor = items.get(cursor)?.parentId
  }
}

export const attachChild = (items: ReadonlyMap<string, WorkItem>, parentId: string, childId: string): WorkItem => {
  const parent = items.get(parentId)
  if (!parent) throw new TreeInvariantError(`unknown parent: ${parentId}`)
  if (parent.children.includes(childId)) return parent
  return { ...parent, children: [...parent.children, childId], updatedAt: Date.now(), version: (parent.version ?? 0) + 1 }
}

export const descendants = (items: ReadonlyMap<string, WorkItem>, rootId: string): ReadonlyArray<WorkItem> => {
  const root = items.get(rootId)
  if (!root) return []
  return root.children.flatMap((id) => {
    const child = items.get(id)
    return child ? [child, ...descendants(items, id)] : []
  })
}
