import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { BoardApi } from "../board.ts"
import { applyOpSchema, createDocSchema } from "./schema.ts"

const docId = z.object({ docId: z.string().min(1) }).strict()

export const docOperations = (board: BoardApi): readonly Operation[] => [
  operation({ name: "board_doc_list", description: "List outline documents", access: "read", input: noInput,
    http: { method: "GET", path: "/api/documents" }, handler: () => ({ documents: board.docList() }) }),
  operation({ name: "board_doc_get", description: "Read one outline document", access: "read", input: docId,
    http: { method: "GET", path: "/api/documents/:docId" }, handler: (input) => board.docGet(input.docId) }),
  operation({ name: "board_doc_create", description: "Create an outline document", input: createDocSchema,
    http: { method: "POST", path: "/api/documents", status: 201 }, handler: (input) => board.docCreate(input) }),
  operation({
    name: "board_doc_apply",
    description: "Apply one outline operation against the version you read (stale versions are refused)",
    input: applyOpSchema,
    http: { method: "POST", path: "/api/documents/:docId" },
    handler: (input) => board.docApply(input),
  }),
  operation({ name: "board_doc_delete", description: "Delete an outline document", input: docId,
    http: { method: "DELETE", path: "/api/documents/:docId" }, handler: (input) => board.docDelete(input.docId) }),
]
