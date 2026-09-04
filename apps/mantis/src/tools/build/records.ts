/**
 * tools/build/records.ts - the READ + MUTATION ops over the workspace.
 *
 * Concept: recall (search) and note_read (full dump) expose the durable
 * store to the model; update_record/delete_record act on one existing record
 * by id (ids always come from recall/read outputs). Over-limit text and
 * unknown ids fail with explicit, readable errors - never silent.
 */
import { Effect, Schema } from "effect"
import { Op } from "@effect-agent/core"
import { EntriesOut, manifestDescription, Text, toOut } from "../schemas.ts"
import { overRecordLimit } from "../contract.ts"
import { WORKSPACE_RESOURCES } from "../../workspace.ts"
import type { NotesStore } from "../store.ts"

export const buildRecall = (notes: NotesStore) =>
  Op.read({
    name: "recall_notes",
    description: manifestDescription("recall_notes"),
    input: Schema.Struct({
      query: Schema.String,
      kind: Schema.optional(Schema.Literal(...WORKSPACE_RESOURCES.map((res) => res.kind))),
      source: Schema.optional(Schema.Literal("agent", "ui"))
    }),
    output: EntriesOut,
    execute: ({ query, kind, source }) => Effect.succeed({ entries: toOut(notes.search(query, kind, source)) })
  })

export const buildRead = (notes: NotesStore) =>
  Op.read({
    name: "note_read",
    description: manifestDescription("note_read"),
    input: Schema.Struct({}),
    output: EntriesOut,
    execute: () => Effect.succeed({ entries: toOut(notes.all()) })
  })

export const buildUpdateDelete = (notes: NotesStore) => {
  const update_record = Op.write({
    name: "update_record",
    description: manifestDescription("update_record"),
    input: Schema.Struct({ id: Schema.String, text: Schema.String }),
    output: EntriesOut,
    execute: ({ id, text }) => {
      const over = overRecordLimit(text)
      if (over !== undefined) return Effect.fail(new Error(over))
      const updated = notes.update(id, text)
      if (updated === undefined) return Effect.fail(new Error("update_record: no record with id " + id))
      return Effect.succeed({ entries: toOut([updated]) })
    }
  })
  const delete_record = Op.write({
    name: "delete_record",
    description: manifestDescription("delete_record"),
    input: Schema.Struct({ id: Schema.String }),
    output: Schema.Struct({ ok: Schema.Boolean, detail: Schema.String }),
    execute: ({ id }) => {
      if (!notes.remove(id)) return Effect.fail(new Error("delete_record: no record with id " + id))
      return Effect.succeed({ ok: true, detail: "deleted record " + id })
    }
  })
  return { update_record, delete_record }
}
