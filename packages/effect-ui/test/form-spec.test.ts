import { expect, test } from "bun:test"
import { formToJsonSpec } from "../src/form-spec.ts"
import { providerSchema, scalarSchema } from "./form-fixture.ts"

test("json spec preserves scalar control semantics and exposes explicit strategies", () => {
  const spec = formToJsonSpec("board", scalarSchema, { webPort: 4100, captureBodies: true })
  expect(spec.root).toBe("root")
  const elements = Object.values(spec.elements)
  const field = (label: string) => elements.find(element => element.type === "TextField" && element.props.label === label)!.props
  expect(field("webPort").value).toBe("4100")
  expect(field("webPort").inputType).toBe("number")
  expect(field("captureBodies").checked).toBe(true)
  expect(field("optionalKey").inputType).toBe("password")
  expect(field("optionalFlag").unset).toBe(true)
  expect(field("webPort").fieldPath).toBe("webPort")
  expect(field("coordinator").options).toEqual(["none", "deepseek"])
  expect(elements.filter(element => element.type === "Button").map(element => element.props.strategy)).toEqual(["apply", "restart"])
})

test("json spec describes arbitrary array rows without fixed protocol blocks", () => {
  const providers = ["east", "west", "backup", "local"].map(id => ({
    id, apiType: "openai.chat", baseURL: `https://${id}.test`, enabled: id !== "backup",
  }))
  const spec = formToJsonSpec("gateway", providerSchema, { providers })
  const array = Object.values(spec.elements).find(element => element.props.role === "array")!
  expect(array.children?.length).toBe(providers.length)
  expect(array.props.discriminator).toBeUndefined()
  for (const [index, id] of array.children!.entries()) {
    const fields = spec.elements[id].children!.map(child => spec.elements[child].props)
    expect(fields.map(field => field.label)).toEqual(["id", "apiType", "baseURL", "apiKey", "enabled"])
    expect(fields[0].value).toBe(providers[index].id)
    expect(fields[1].options).toEqual(["openai.chat", "openai.responses", "anthropic.message"])
    expect(fields[1].readOnly).not.toBe(true)
    expect(fields[4].checked).toBe(providers[index].enabled)
  }
})
