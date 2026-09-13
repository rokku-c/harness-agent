/**
 * Outline rewrites, as pure functions returning new trees. Nothing here knows
 * about versions or storage: the service owns when a write is allowed, this file
 * owns what the write does to the tree.
 */
import { BoardError } from "../tasks/schema.ts"
import type { NodeOp, OutlineNode } from "./schema.ts"

const rewrite = (nodes: readonly OutlineNode[], fn: (node: OutlineNode) => OutlineNode): OutlineNode[] =>
  nodes.map((node) => fn({ ...node, children: rewrite(node.children, fn) }))

const spliceAt = (nodes: readonly OutlineNode[], index: number, node: OutlineNode): OutlineNode[] => {
  const next = [...nodes]
  next.splice(Math.min(index, next.length), 0, node)
  return next
}

export const findNode = (nodes: readonly OutlineNode[], nodeId: string): OutlineNode | undefined => {
  for (const node of nodes) {
    if (node.nodeId === nodeId) return node
    const found = findNode(node.children, nodeId)
    if (found !== undefined) return found
  }
  return undefined
}
/** How many nodes a subtree holds, so a removal can say what went with it. */
export const countNodes = (nodes: readonly OutlineNode[]): number =>
  nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0)
export const subtreeSize = (nodes: readonly OutlineNode[], nodeId: string): number => {
  const node = findNode(nodes, nodeId)
  return node === undefined ? 0 : countNodes([node])
}

const insert = (nodes: readonly OutlineNode[], parentId: string | null, index: number, node: OutlineNode): OutlineNode[] => {
  if (parentId === null) return spliceAt(nodes, index, node)
  if (findNode(nodes, parentId) === undefined) throw new BoardError(404, `Outline node not found: ${parentId}`)
  return rewrite(nodes, (current) =>
    current.nodeId === parentId ? { ...current, children: spliceAt(current.children, index, node) } : current)
}
export const removeNode = (nodes: readonly OutlineNode[], nodeId: string): OutlineNode[] =>
  nodes.filter((node) => node.nodeId !== nodeId)
    .map((node) => ({ ...node, children: removeNode(node.children, nodeId) }))

export const applyOp = (nodes: readonly OutlineNode[], op: NodeOp, newId: string): OutlineNode[] => {
  if (op.kind === "insert") return insert(nodes, op.parentId, op.index, { nodeId: newId, text: op.text, done: false, children: [] })
  const target = findNode(nodes, op.nodeId)
  if (target === undefined) throw new BoardError(404, `Outline node not found: ${op.nodeId}`)
  if (op.kind === "update") return rewrite(nodes, (node) => node.nodeId === op.nodeId ? { ...node, text: op.text } : node)
  if (op.kind === "toggle") return rewrite(nodes, (node) => node.nodeId === op.nodeId ? { ...node, done: op.done } : node)
  if (op.kind === "remove") return removeNode(nodes, op.nodeId)
  // a move into the node's own subtree would drop that subtree on the floor
  if (op.parentId === op.nodeId || (op.parentId !== null && findNode(target.children, op.parentId) !== undefined)) {
    throw new BoardError(409, `Cannot move ${op.nodeId} inside itself`)
  }
  return insert(removeNode(nodes, op.nodeId), op.parentId, op.index, target)
}
