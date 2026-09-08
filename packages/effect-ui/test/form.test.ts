import { expect, test } from "bun:test"
import { configFormModel, renderConfigForm } from "../src/form.ts"
import { scalarSchema, formElements } from "./form-fixture.ts"

test("schema form exposes correctly typed controls, labels and both save strategies", async () => {
  const html = renderConfigForm("board", scalarSchema)
  const forms = await formElements(html, "form")
  expect(forms.map(form => form["data-config-app"])).toEqual(["board"])
  const controls = await formElements(html, "[data-field]")
  const byKey = Object.fromEntries(controls.map(field => [field["data-field"], field]))
  expect(byKey.dataFile.value).toBe(".effect-agent/board.jsonl")
  expect(byKey.webPort.type).toBe("number")
  expect(byKey.webPort.step).toBe("1")
  expect(byKey.ratio.step).toBe("any")
  expect(byKey.captureBodies.type).toBe("checkbox")
  expect(byKey.coordinator.tag).toBe("select")
  expect(byKey.optionalKey.type).toBe("password")
  expect(byKey.optionalFlag.tag).toBe("select")
  const labels = await formElements(html, "label[for]")
  expect(labels.map(label => label.for)).toEqual(controls.map(control => control.id))
  expect((await formElements(html, "button[type=submit]")).map(button => button["data-strategy"])).toEqual(["apply", "restart"])
})

test("merged values and provenance live in the model, not in template assertions", () => {
  const form = configFormModel.create("board", scalarSchema, { webPort: 4100, captureBodies: true }, { webPort: "yaml" })
  const port = form.root.fields.find(field => field.key === "webPort")!
  expect(port.value).toBe(4100)
  expect(port.source).toBe("yaml")
  expect(form.root.fields.find(field => field.key === "captureBodies")!.value).toBe(true)
})

test("missing schemas have no editable fields or enabled submit action", async () => {
  const html = renderConfigForm("absent", undefined)
  expect(configFormModel.create("absent").declared).toBe(false)
  expect(await formElements(html, "[data-field]")).toEqual([])
  expect((await formElements(html, "button[type=submit]")).every(button => "disabled" in button)).toBe(true)
})

test("untrusted identifiers and values remain attributes rather than injected elements", async () => {
  const key = 'key"><script>', value = '\"><img src=x onerror=alert(1)>'
  const html = renderConfigForm(key, { properties: { [key]: { type: "string" } } }, { [key]: value })
  expect(await formElements(html, "script,img")).toEqual([])
  expect((await formElements(html, "[data-field]")).map(input => input.type)).toEqual(["password"])
  expect(configFormModel.create(key, { properties: { [key]: { type: "string" } } }, { [key]: value }).root.fields[0].value).toBe(value)
})
