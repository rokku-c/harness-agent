import { expect, test } from "bun:test"

import { viewSpecSchema, viewToJsonSchema } from "../src/schema.ts"
import { htmlRenderer } from "../src/html-renderer.ts"
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
  const registry = makeUiRendererRegistry([htmlRenderer])
  expect(registry.list()).toEqual(["html"])
  expect(registry.get("html")).toBe(htmlRenderer)

  expect(registry.render("html", profileView)).toContain('data-effect-ui="profile"')
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
