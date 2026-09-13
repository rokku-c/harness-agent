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
    { component: "Text", props: { value: "Hello <world>" } },
    {
      component: "Flex",
      id: "actions",
      props: { direction: "row", gap: "2" },
      children: [
        { component: "Button", props: { value: "Save" }, onPress: "save_profile" },
        { component: "Button", props: { value: "Cancel" } },
      ],
    },
    { component: "TextField.Root", props: { placeholder: "Your name" }, bind: "/name" },
    { component: "Card", props: { value: "one" } },
    { component: "Table.Root", props: { variant: "surface" }, children: [{ component: "Table.Row" }] },
  ],
}

test("the view schema is recursive and open: a node names a component, and its props are that library's", () => {
  const parse = viewSpecSchema()
  const parsed = parse.parse(profileView)
  expect(parsed.viewId).toBe("profile")
  expect(parsed.nodes).toHaveLength(5)
  expect(parse.safeParse({ viewId: "bad", nodes: [{ props: { value: "no component named" } }] }).success).toBe(false)

  const schema = viewToJsonSchema() as unknown as { type: string; properties: Record<string, unknown> }
  expect(schema.type).toBe("object")
  expect(schema.properties.viewId).toBeDefined()
  expect(schema.properties.nodes).toBeDefined()
  // every directive a live view needs is part of the exported contract
  const exported = JSON.stringify(schema)
  for (const directive of ["component", "bind", "item", "as", "repeat", "visible", "onPress", "params"]) {
    expect(exported).toContain(`"${directive}"`)
  }
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

test("the html renderer names the design system's component and escapes what it was given", () => {
  const html = htmlRenderer.render(profileView)
  expect(html).toContain('data-effect-ui="profile"')
  expect(html).toContain('data-component="Table.Root"')
  expect(html).toContain("Hello &lt;world&gt;")
  expect(html).toContain('data-action="save_profile"')
  expect(html).toContain('data-bind="/name"')
})

test("the ui-* bridge renders a view through ui-renderer webRenderer with the same component names", () => {
  const html = effectUiWebRenderer.render(profileView)
  expect(html).toContain("<h1>Profile</h1>")
  expect(html).toContain("Save")
  expect(html).toContain("one")
  expect(html).toContain('data-component="Flex"')
})
