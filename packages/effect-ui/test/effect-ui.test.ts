import { expect, test } from "bun:test"

import { viewSpecSchema, viewToJsonSchema } from "../src/schema.ts"
import { htmlRenderer } from "../src/html-renderer.ts"
import { effectUiWebRenderer } from "../src/web-bridge.ts"
import { makeUiRendererRegistry } from "../src/renderer.ts"
import type { EffectUiView } from "../src/spec.ts"

const profileView: EffectUiView = {
  viewId: "profile",
  title: "Profile",
  nodes: [
    { kind: "text", id: "greeting", text: "Hello <world>" },
    {
      kind: "stack",
      id: "actions",
      direction: "horizontal",
      gap: 8,
      children: [
        { kind: "button", label: "Save", onPress: "save_profile" },
        { kind: "button", label: "Cancel" },
      ],
    },
    { kind: "formField", label: "Name", value: "Ada", placeholder: "Your name" },
    { kind: "list", items: ["one", "two"] },
  ],
}

test("view spec schema is recursive and exports as JSON Schema with all node kinds", () => {
  const parsed = viewSpecSchema().parse(profileView)
  expect(parsed.viewId).toBe("profile")
  expect(parsed.nodes).toHaveLength(4)

  const schema = viewToJsonSchema() as unknown as {
    type: string
    properties: Record<string, unknown>
    $defs?: Record<string, { oneOf?: Array<{ properties: { kind: { const: string } } }> }>
  }
  expect(schema.type).toBe("object")
  expect(schema.properties.viewId).toBeDefined()
  expect(schema.properties.nodes).toBeDefined()
  const union = Object.values(schema.$defs ?? {}).find((def) => def.oneOf !== undefined)
  const kinds = (union?.oneOf ?? []).map((member) => member.properties.kind.const)
  expect(kinds).toEqual(["text", "stack", "button", "formField", "list"])
})

test("same view renders distinctly across the two renderers via the registry", () => {
  const registry = makeUiRendererRegistry([htmlRenderer, effectUiWebRenderer])
  expect(registry.list().sort()).toEqual(["html", "ui-protocol-html"])

  const html = registry.render("html", profileView)
  const bridged = registry.render("ui-protocol-html", profileView)
  expect(html).not.toBe(bridged)
  expect(html).toContain('data-effect-ui="profile"')
  expect(bridged).toContain('data-canvas="profile"')

  expect(() => registry.render("missing", profileView)).toThrow(/not found/)
})

test("ui-* bridge renders a view through ui-renderer webRenderer with expected text", () => {
  const html = effectUiWebRenderer.render(profileView)
  expect(html).toContain("<h1>Profile</h1>")
  expect(html).toContain("Hello &lt;world&gt;")
  expect(html).toContain("Save")
  expect(html).toContain("one")
  expect(html).toContain('data-component="Stack"')
})

test("html renderer emits self-contained, escaped declarative HTML", () => {
  const html = htmlRenderer.render(profileView)
  expect(html).toContain('data-effect-ui="profile"')
  expect(html).toContain("Hello &lt;world&gt;")
  expect(html).toContain("<ul")
  expect(html).toContain("<button")
})
