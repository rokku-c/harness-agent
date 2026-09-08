import { expect, test } from "bun:test"
import { toJsonSchema } from "@effect-agent/effect-config"
import { createFormModel, parseConfigForm, type JsonSchema } from "../../../packages/effect-ui/src/form.ts"
import { effectConfig } from "../src/effect-config.ts"
import { providers } from "./helpers.ts"

test("actual gateway schema supports repeated-type form rows without inventing URL/key", () => {
  const schema = toJsonSchema(effectConfig.schema) as JsonSchema
  const model = createFormModel()
  const form = model.create("ai-gateway", schema)
  const array = form.root.fields.find(field => field.key === "providers")!
  expect(array.rows).toEqual([])
  expect(parseConfigForm(form)).toEqual({})
  const configured = ["east", "west", "local", "disabled"].map(id => ({
    id, apiType: providers[0].apiType, baseURL: `http://${id}.test`, enabled: id !== "disabled",
  }))
  for (const provider of configured) {
    const row = model.add(array)
    for (const field of row.fields) field.value = provider[field.key as keyof typeof provider]
  }
  expect(effectConfig.schema.parse(parseConfigForm(form))).toEqual({ providers: configured })
  model.remove(array, 1)
  expect(effectConfig.schema.parse(parseConfigForm(form))).toEqual({ providers: [configured[0], configured[2], configured[3]] })
  const incomplete = model.add(array)
  incomplete.fields.find(field => field.key === "id")!.value = "missing-url"
  incomplete.fields.find(field => field.key === "apiType")!.value = "openai.chat"
  expect(() => parseConfigForm(form)).toThrow("ai-gateway.providers[3].baseURL")
})
