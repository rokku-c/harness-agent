/** ops/schemas.ts - the COORDINATOR OPS INPUT/OUTPUT SHAPES.
 *  Concept: the builtin coordinator agent's tool surface is declared with
 *  Effect Schema - same store the MCP surface exposes, so a coordinated
 *  breakdown and an external executor's report are literally the same
 *  board. The shape of the write stays schema-driven here. */
import { Schema } from "effect"

export const OptionalString = Schema.optional(Schema.String)

export const ItemShape = Schema.Struct({
  itemId: Schema.String,
  title: Schema.String,
  state: Schema.String,
  priority: Schema.String,
  body: OptionalString,
  assigneeId: OptionalString,
  blockedReason: OptionalString,
  dependencies: Schema.Array(Schema.String),
  children: Schema.Array(Schema.String)
})
export const CreateIn = Schema.Struct({
  title: Schema.String,
  body: OptionalString,
  parentId: OptionalString,
  priority: OptionalString,
  dependencies: Schema.optional(Schema.Array(Schema.String)),
  labels: Schema.optional(Schema.Array(Schema.String)),
  requires: Schema.optional(
    Schema.Array(Schema.Struct({ resourceId: Schema.String, amount: Schema.optional(Schema.Number) }))
  )
})
export const CreateOut = Schema.Struct({ ok: Schema.Boolean, itemId: OptionalString, detail: OptionalString })
export const ReadOut = Schema.Struct({ item: Schema.optional(ItemShape) })
export const ViewOut = Schema.Struct({
  view: Schema.Struct({
    name: Schema.String,
    columns: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        title: Schema.String,
        states: Schema.Array(Schema.String),
        itemIds: Schema.Array(Schema.String)
      })
    )
  })
})
