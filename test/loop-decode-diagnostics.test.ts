import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import * as Core from "@effect-agent/core"
import { causeDetail } from "../packages/builtin/src/loop/execute.ts"

const secret = "sk-model-private-input"
const diagnostic = <A>(schema: Schema.Schema<A, any, never>, input: unknown) =>
  Effect.runPromise(Core.decode(schema, input).pipe(Effect.flip, Effect.map(causeDetail)))

test("decode errors retain declared nested field paths and array indices, never values or arguments", async () => {
  const schema = Schema.Struct({ items: Schema.Array(Schema.Struct({ count: Schema.Number })), apiKey: Schema.String })
  const detail = await diagnostic(schema, { items: [{ count: secret }], apiKey: secret })
  expect(detail).toBe("Invalid tool input: $.items[0].count: expected number")
})

test("missing fields give a readable diagnostic without dumping the containing object", async () => {
  const schema = Schema.Struct({ reply: Schema.String, apiKey: Schema.String })
  expect(await diagnostic(schema, { apiKey: secret })).toBe("Invalid tool input: $.reply: missing required field")
})

test("dynamic record keys are hidden because they can contain model credentials", async () => {
  const schema = Schema.Record({ key: Schema.String, value: Schema.Number })
  expect(await diagnostic(schema, { [secret]: secret })).toBe("Invalid tool input: $[key]: expected number")
})

test("literal values and schema message callbacks never enter decode diagnostics", async () => {
  const literal = Schema.Literal("private-schema-literal").annotations({ message: () => secret })
  expect(await diagnostic(literal, secret)).toBe("Invalid tool input: $: expected declared literal")
  const refined = Schema.Number.pipe(Schema.filter((value) => value > 0, { message: () => secret }))
  expect(await diagnostic(refined, -1)).toBe("Invalid tool input: $: expected refined value")
})

test("non-parse failures do not fall back to serializing their raw cause", () => {
  expect(causeDetail({ cause: { apiKey: secret, args: { reply: secret } } }))
    .toBe("Tool input does not match the declared schema")
  expect(causeDetail(new Error(secret))).toBe("Tool input does not match the declared schema")
})

test("core exports native schema decoding but no longer exports text JSON decoding", async () => {
  expect("decodeJson" in Core).toBe(false)
  expect(await Effect.runPromise(Core.decode(Schema.Number, 7))).toBe(7)
})
