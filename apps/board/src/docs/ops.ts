/**
 * The document surface: outline documents, declared once.
 *
 * Documents are edited one operation at a time against the version they were
 * read at, because two collaborators touching different parts of one outline is
 * the normal case and a whole-document write is what makes that lose work.
 */
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { BoardApi } from "../board.ts"
import { applyOpSchema, createDocSchema } from "./schema.ts"

const docId = z.object({ id: z.string().min(1) }).strict()

export const docOperations = (board: BoardApi): readonly Operation[] => [
  operation({ name: "board_doc_list", description: "List outline documents", access: "read", input: noInput,
    http: { method: "GET", path: "/api/documents" }, handler: () => ({ documents: board.docList() }) }),
  operation({ name: "board_doc_get", description: "Read one outline document", access: "read", input: docId,
    http: { method: "GET", path: "/api/documents/:id" }, handler: (input) => board.docGet(input.id) }),
  operation({ name: "board_doc_create", description: "Create an outline document", input: createDocSchema,
    http: { method: "POST", path: "/api/documents", status: 201 }, handler: (input) => board.docCreate(input) }),
  operation({
    name: "board_doc_apply",
    description: "Apply one outline operation against the version you read (stale versions are refused)",
    input: applyOpSchema,
    // the document is the path, so an operation cannot be applied to a document
    // other than the one it was read from
    http: { method: "POST", path: "/api/documents/:id" },
    handler: (input) => board.docApply(input),
  }),
  operation({ name: "board_doc_delete", description: "Delete an outline document", input: docId,
    http: { method: "DELETE", path: "/api/documents/:id" }, handler: (input) => board.docDelete(input.id) }),
]
