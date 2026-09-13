/**
 * Document storage. The version check is the collaboration guard: an operation
 * built on a version that has already moved is refused rather than applied, so a
 * stale editor is told to refetch instead of silently undoing someone's edit.
 */
import type { TaskStore } from "../storage/store.ts"
import { BoardError, parse } from "../tasks/schema.ts"
import { applyOp, subtreeSize } from "./outline.ts"
import { applyOpSchema, createDocSchema, type ApplyOpInput, type CreateDocInput, type Document } from "./schema.ts"
import type { DocStore } from "./store.ts"

export const makeDocumentService = (store: TaskStore, docs: DocStore, now: () => number = Date.now) => {
  const get = (docId: string): Document => {
    const doc = docs.get(docId)
    if (doc === undefined) throw new BoardError(404, `Document not found: ${docId}`)
    return doc
  }
  const write = (doc: Document, at: number): Document => {
    // the version moves on every accepted operation, whichever collaborator sent it
    const next = { ...doc, version: doc.version + 1, updatedAt: Math.max(at, doc.updatedAt + 1) }
    docs.put(next)
    return next
  }
  return {
    list: () => docs.list().map(({ docId, title, version, updatedAt }) => ({ docId, title, version, updatedAt })),
    get,
    create: (input: CreateDocInput): Document => store.transaction(() => {
      const value = parse(createDocSchema, input), at = now()
      const doc: Document = { docId: crypto.randomUUID(), title: value.title, nodes: value.nodes, version: 0, createdAt: at, updatedAt: at }
      docs.put(doc); store.event("doc.created", doc.docId, doc)
      return doc
    }),
    apply: (input: ApplyOpInput): Document => store.transaction(() => {
      const value = parse(applyOpSchema, input), doc = get(value.docId)
      if (doc.version !== value.version) {
        throw new BoardError(409, `Document ${doc.docId} advanced to version ${doc.version}; refetch before applying an operation built on ${value.version}`)
      }
      const newId = crypto.randomUUID(), at = now()
      // a rename is versioned like any other edit, so it cannot race an outline change
      const edited: Document = value.op.kind === "retitle"
        ? { ...doc, title: value.op.title }
        : { ...doc, nodes: applyOp(doc.nodes, value.op, newId) }
      const dropped = value.op.kind === "remove" ? subtreeSize(doc.nodes, value.op.nodeId) : 0
      const next = write(edited, at)
      store.event("doc.applied", doc.docId, { op: value.op, version: next.version, ...(dropped ? { droppedNodes: dropped } : {}) })
      return next
    }),
    delete: (docId: string) => store.transaction(() => {
      const doc = get(docId)
      docs.delete(docId); store.event("doc.deleted", docId, { title: doc.title })
      return { ok: true }
    }),
  }
}
export type DocumentService = ReturnType<typeof makeDocumentService>
