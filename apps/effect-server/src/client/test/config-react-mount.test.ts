import { expect, test } from "bun:test"
import { parseFieldValue } from "../config-array.ts"
import { formToJsonSpec } from "@effect-agent/effect-ui"
import { rewriteArrayRowPaths } from "../config-array.ts"

test("required boolean fields project as checkbox controls", () => {
  const spec = formToJsonSpec("app", { type: "object", properties: { enabled: { type: "boolean" } }, required: ["enabled"] }, { enabled: true })
  expect(spec.elements["cfg-2"]?.props?.inputType).toBe("checkbox")
})

test("reads only finite numbers and integers", () => {
  const input = (value: string) => ({ type: "number", value } as unknown as HTMLInputElement)
  expect(parseFieldValue({ dataset: { kind: "number" } } as unknown as HTMLElement, input("1.5"))).toBe(1.5)
  expect(() => parseFieldValue({ dataset: { kind: "number" } } as unknown as HTMLElement, input("Infinity"))).toThrow("Invalid number value")
  expect(() => parseFieldValue({ dataset: { kind: "integer" } } as unknown as HTMLElement, input("1.5"))).toThrow("Invalid integer value")
})

test("rewrites nested array paths in child order", () => {
  const elements = {
    row: { type: "Stack", props: { fieldPath: "providers.2" }, children: ["name", "auth"] },
    name: { type: "Input", props: { fieldPath: "providers.2.name" } },
    auth: { type: "Stack", props: { fieldPath: "providers.2.auth" }, children: ["token"] },
    token: { type: "Input", props: { fieldPath: "providers.2.auth.token" } },
  }
  rewriteArrayRowPaths(elements, "row", "providers.0")
  expect(elements.name.props?.fieldPath).toBe("providers.0.name")
  expect(elements.token.props?.fieldPath).toBe("providers.0.auth.token")
})
