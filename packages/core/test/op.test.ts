/**
 * schemaJson sanitization: provider tool input_schema must be a clean
 * conventional object schema. Effect's JSONSchema.make emits draft-07
 * document keys that tool APIs reject - notably a RELATIVE "$id" (Anthropic:
 * "relative URL without a base") and a bogus anyOf(object, array) for empty
 * structs. This regressed in the real-model chat smoke test.
 */
import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { schemaJson } from "../src/op.ts"

describe("schemaJson", () => {
  test("empty structs serialize as a plain object - no relative $id, no bogus anyOf", () => {
    expect(schemaJson(Schema.Struct({}))).toEqual({ type: "object" })
  })

  test("property schemas stay intact without draft-07 document keys", () => {
    const json = schemaJson(Schema.Struct({ name: Schema.String }))
    expect(json).not.toHaveProperty("$schema")
    expect(json).not.toHaveProperty("$id")
    expect(json).toEqual({
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
      additionalProperties: false
    })
  })

  test("optional + literal shapes survive", () => {
    const json = schemaJson(
      Schema.Struct({ kind: Schema.optional(Schema.Literal("note", "reminder")), query: Schema.String })
    ) as Record<string, unknown>
    expect(json.required).toEqual(["query"])
    const properties = json.properties as Record<string, unknown>
    expect(properties.kind).toEqual({ type: "string", enum: ["note", "reminder"] })
  })
})
