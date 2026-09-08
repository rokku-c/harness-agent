import { expect, test } from "bun:test"
import { createFormModel, parseConfigForm } from "../src/form.ts"
import { scalarSchema } from "./form-fixture.ts"

const model = createFormModel()
test("scalar parsing preserves numbers, zero, false, typed enums and optional absence", () => {
  const form = model.create("board", scalarSchema)
  const set = (key: string, value: unknown) => { form.root.fields.find(field => field.key === key)!.value = value }
  set("webPort", "4200"); set("ratio", "0.25"); set("captureBodies", false)
  set("optionalKey", ""); set("optionalFlag", undefined); set("optionalMode", undefined); set("numericEnum", 0)
  expect(parseConfigForm(form)).toEqual({ dataFile: ".effect-agent/board.jsonl", webPort: 4200,
    ratio: 0.25, captureBodies: false, coordinator: "none", numericEnum: 0 })
  set("optionalFlag", false); set("ratio", "0")
  expect(parseConfigForm(form).optionalFlag).toBe(false)
  expect(parseConfigForm(form).ratio).toBe(0)
})

test("invalid integer, non-finite numbers, out-of-range and invalid enums fail with a field path", () => {
  for (const value of ["abc", "1.5", "Infinity", "NaN", "", "  ", "0", "65536", true]) {
    const form = model.create("board", scalarSchema)
    form.root.fields.find(field => field.key === "webPort")!.value = value
    expect(() => parseConfigForm(form)).toThrow("board.webPort")
  }
  const form = model.create("board", scalarSchema)
  form.root.fields.find(field => field.key === "optionalMode")!.value = "unknown"
  expect(() => parseConfigForm(form)).toThrow("board.optionalMode")
})

test("optional nested objects are absent unless populated, rather than stringified", () => {
  const form = model.create("app", { properties: { auth: {
    type: "object", properties: { token: { type: "string" } },
  } } })
  expect(parseConfigForm(form)).toEqual({})
  form.root.fields[0].fields[0].value = "secret"
  expect(parseConfigForm(form)).toEqual({ auth: { token: "secret" } })
})

test("generic arrays add/remove whole typed rows and persist an explicitly emptied array", () => {
  const form = model.create("app", { properties: { endpoints: {
    type: "array", items: { type: "object", required: ["port"], properties: { port: { type: "integer" } } },
  } } })
  const array = form.root.fields[0]
  expect(parseConfigForm(form)).toEqual({})
  model.add(array).fields[0].value = "8080"
  model.add(array).fields[0].value = "9090"
  expect(parseConfigForm(form)).toEqual({ endpoints: [{ port: 8080 }, { port: 9090 }] })
  model.remove(array, 0)
  expect(parseConfigForm(form)).toEqual({ endpoints: [{ port: 9090 }] })
  model.remove(array, 0)
  expect(parseConfigForm(form)).toEqual({ endpoints: [] })
  expect(() => model.remove(array, 0)).toThrow("Invalid array index")
})

test("array bounds and primitive item types are enforced", () => {
  const form = model.create("app", { properties: { ports: {
    type: "array", minItems: 1, maxItems: 1, items: { type: "integer" },
  } } }, { ports: [] })
  const array = form.root.fields[0]
  expect(() => parseConfigForm(form)).toThrow("minimum items")
  model.add(array).value = "42"
  expect(parseConfigForm(form)).toEqual({ ports: [42] })
  expect(() => model.add(array)).toThrow("Maximum array size")
})
