import { expect, test } from "bun:test"
import { createFormModel, parseConfigForm, renderConfigForm } from "../src/form.ts"
import { providerSchema, formElements } from "./form-fixture.ts"

const model = createFormModel()
test("provider arrays start empty and offer add, not fixed protocol toggles", async () => {
  const form = model.create("gateway", providerSchema)
  expect(form.root.fields[0].rows).toEqual([])
  expect(parseConfigForm(form)).toEqual({ providers: [] })
  const html = renderConfigForm("gateway", providerSchema)
  expect((await formElements(html, "[data-add]")).length).toBe(1)
  expect(await formElements(html, "[data-toggle],[data-remove],[data-field]")).toEqual([])
})

test("adding same-type rows serializes every ID, optional key and explicit disabled state", () => {
  const form = model.create("gateway", providerSchema)
  const array = form.root.fields[0]
  const providers = ["east", "west", "backup", "local"].map(id => ({
    id, apiType: "openai.chat", baseURL: `https://${id}.test`, enabled: id !== "backup",
  }))
  for (const value of providers) {
    const row = model.add(array)
    expect(row.fields.find(field => field.key === "baseURL")!.value).toBeUndefined()
    for (const field of row.fields) field.value = value[field.key as keyof typeof value]
  }
  expect(parseConfigForm(form)).toEqual({ providers })
  expect(parseConfigForm(model.create("gateway", providerSchema, parseConfigForm(form)))).toEqual({ providers })
  model.remove(array, 1)
  expect(parseConfigForm(form)).toEqual({ providers: [providers[0], providers[2], providers[3]] })
  while (array.rows.length) model.remove(array, 0)
  expect(parseConfigForm(form)).toEqual({ providers: [] })
})

test("every row renders editable ID/type/URL/key/enabled controls and a remove action", async () => {
  const providers = ["east", "west"].map(id => ({ id, apiType: "openai.chat", baseURL: `https://${id}.test` }))
  const html = renderConfigForm("gateway", providerSchema, { providers })
  const controls = await formElements(html, "[data-field]")
  expect(controls.map(input => input["data-field"])).toEqual(Array(2).fill(["id", "apiType", "baseURL", "apiKey", "enabled"]).flat())
  expect(controls.filter(input => input["data-field"] === "apiType").map(input => input.tag)).toEqual(["select", "select"])
  expect(controls.filter(input => input["data-field"] === "apiKey").map(input => input.type)).toEqual(["password", "password"])
  expect((await formElements(html, "[data-remove]")).map(button => button["data-index"])).toEqual(["0", "1"])
  expect((await formElements(html, "[data-add]")).length).toBe(1)
  expect(await formElements(html, "fieldset[disabled],[data-toggle]")).toEqual([])
})

test("incomplete added rows fail validation instead of silently disappearing", () => {
  const form = model.create("gateway", providerSchema)
  const row = model.add(form.root.fields[0])
  expect(() => parseConfigForm(form)).toThrow("gateway.providers[0].id")
  row.fields.find(field => field.key === "id")!.value = "east"
  expect(() => parseConfigForm(form)).toThrow("gateway.providers[0].apiType")
  row.fields.find(field => field.key === "apiType")!.value = "openai.chat"
  expect(() => parseConfigForm(form)).toThrow("gateway.providers[0].baseURL")
})

test("generic enum rows use only actual values; explicitly declared schema defaults still apply", () => {
  const schema = { properties: { upstreams: { type: "array", items: {
    type: "object", properties: { apiType: { type: "string", enum: ["custom.rpc"] },
      baseURL: { type: "string", default: "https://schema-default.test" } },
  } } } }
  const form = model.create("other-app", schema)
  expect(form.root.fields[0].rows).toEqual([])
  const row = model.add(form.root.fields[0])
  row.fields[0].value = "custom.rpc"
  expect(parseConfigForm(form)).toEqual({ upstreams: [{ apiType: "custom.rpc", baseURL: "https://schema-default.test" }] })
})
