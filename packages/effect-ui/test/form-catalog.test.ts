import { expect, test } from "bun:test"
import { formComponents } from "../src/form-catalog.ts"
import { getMinimalProjection, getRolePropsSchema, getRoleRadixMapping } from "../src/role-registry.ts"

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
