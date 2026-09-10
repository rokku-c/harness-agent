import { expect, test } from "bun:test"
import { formComponents } from "../src/form-catalog.ts"
import { getMinimalProjection, getRoleEvents, getRolePropsSchema, getRoleRadixMapping } from "../src/role-registry.ts"
import { roleElement } from "../src/role-spec.ts"

test("shared catalog contains primitive and system roles", () => {
  expect(Object.keys(formComponents).sort()).toEqual(["BottomTab", "Button", "Dock", "Input", "Select", "SettingsGroup", "Springboard", "Stack", "Switch", "Text", "TopBar"])
})

test("role schemas validate controls and export Radix behavior", () => {
  expect(formComponents.Switch.props.safeParse({ label: "Enable", checked: true }).success).toBe(true)
  expect(formComponents.Switch.props.safeParse({ checked: "yes" }).success).toBe(false)
  expect(formComponents.Select.props.toJSONSchema().type).toBe("object")
  expect(getRoleRadixMapping("Switch").primitiveId).toBe("Switch.Root")
})

test("role boundary rejects unknown roles and projects minimal props", () => {
  expect(getMinimalProjection("Button", { label: "Save" })).toEqual({ role: "Button", primitiveId: "Button", props: { label: "Save" } })
  expect(getRoleRadixMapping("Dock").primitiveId).toBe("NavigationMenu.Root")
  expect(() => getRolePropsSchema("MissingRole")).toThrow("Unknown UI role: MissingRole")
})

test("interactive roles declare renderer events", () => {
  expect(getRoleEvents("Button")).toEqual(["press"])
  expect(getRoleEvents("Switch")).toEqual(["change"])
  expect(getRoleEvents("Text")).toEqual([])
})

test("role elements preserve declared events and reject undeclared ones", () => {
  const element = roleElement("Button", { label: "Open" }, undefined, { press: { action: "open" } })
  expect(element.on).toEqual({ press: { action: "open" } })
  expect(() => roleElement("Text", {}, undefined, { press: { action: "open" } })).toThrow("Unsupported UI event: Text.press")
})
