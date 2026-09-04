/** sanitize: agent-invented props must not blank a whole surface (official strict schemas) */
import { describe, expect, test } from "bun:test"
import { ensureSurfaceRoot, parseA2uiBatch, sanitizeComponent } from "../src/hosts/webui/a2ui.ts"

const badTextField = { id: "tf", component: "TextField", label: "任务", placeholder: "hint", style: { color: "red" }, value: { path: "/form/task" } }

describe("a2ui component sanitize", () => {
  test("strips unknown props from known basic catalog components", () => {
    const cleaned = sanitizeComponent(badTextField)
    expect(Object.keys(cleaned)).not.toContain("placeholder")
    expect(Object.keys(cleaned)).not.toContain("style")
    expect(cleaned.value).toEqual({ path: "/form/task" })
  })
  test("keeps the node layer (id/component) and valid props", () => {
    const cleaned = sanitizeComponent(badTextField)
    expect(cleaned.id).toBe("tf")
    expect(cleaned.component).toBe("TextField")
    expect(cleaned.label).toBe("任务")
  })
  test("leaves unknown components untouched (genuine model errors stay visible)", () => {
    const custom = { id: "x", component: "FancyWidget", foo: 1 } as never
    expect(sanitizeComponent(custom)).toBe(custom)
  })
  test("parseA2uiBatch sanitizes every updateComponents batch", () => {
    const spec = JSON.stringify([
      { version: "v0.9", createSurface: { surfaceId: "main", catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json" } },
      { version: "v0.9", updateComponents: { surfaceId: "main", components: [badTextField, { id: "note", component: "Text", text: "note" }] } }
    ])
    const result = parseA2uiBatch(spec)
    expect(result.error).toBeUndefined()
    const update = result.messages.find((m) => "updateComponents" in m)
    const components = update && "updateComponents" in update ? update.updateComponents.components : []
    const field = components.find((c) => (c as Record<string, unknown>).id === "tf")
    expect(field).not.toHaveProperty("placeholder")
    expect((field as Record<string, unknown>).value).toEqual({ path: "/form/task" })
  })
})
describe("a2ui surface tree normalization", () => {
  const makeBatch = (components: Array<Record<string, unknown>>) => [
    { version: "v0.9" as const, updateComponents: { surfaceId: "main", components } }
  ]
  test("a flat batch gets a root Column wrapping every unreferenced component", () => {
    const out = ensureSurfaceRoot(makeBatch([
      { id: "title", component: "Text", text: "hello" },
      { id: "go", component: "Button", child: "bl", action: { event: { name: "go" } } },
      { id: "bl", component: "Text", text: "Go" }
    ]))
    const first = out[0]
    if (first === undefined || !("updateComponents" in first)) throw new Error("no updateComponents")
    const components = first.updateComponents.components
    const root = components.find((c) => c.id === "root")
    expect(root).toBeDefined()
    expect((root as Record<string, unknown>).component).toBe("Column")
    expect((root as Record<string, unknown>).children).toEqual(["title", "go"]) // bl referenced by go.child -> not a root
    expect(components.length).toBe(4)
  })
  test("a batch that already declares id root passes through untouched", () => {
    const batch = makeBatch([{ id: "root", component: "Column", children: ["a"] }, { id: "a", component: "Text", text: "x" }])
    const out = ensureSurfaceRoot(batch)
    const first = out[0]
    if (first === undefined || !("updateComponents" in first)) throw new Error("no updateComponents")
    expect(first.updateComponents.components[0]?.id).toBe("root")
    expect(first.updateComponents.components.length).toBe(2)
  })
  test("parseA2uiBatch returns a tree-normalized batch", () => {
    const spec = JSON.stringify([
      { version: "v0.9", createSurface: { surfaceId: "main", catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json" } },
      { version: "v0.9", updateComponents: { surfaceId: "main", components: [{ id: "hello", component: "Text", text: "hi" }] } }
    ])
    const result = parseA2uiBatch(spec)
    expect(result.error).toBeUndefined()
    const update = result.messages.find((m) => "updateComponents" in m)
    const components = update && "updateComponents" in update ? update.updateComponents.components : []
    expect(components[0]).toHaveProperty("id", "root")
  })
})
describe("sanitize degradation (non-compliant known components)", () => {
  test("Card used as a container (children) degrades to Column so content survives", () => {
    const cleaned = sanitizeComponent({ id: "card1", component: "Card", variant: "outline", children: ["c1", "c2"] })
    expect(cleaned.component).toBe("Column")
    expect(cleaned.children).toEqual(["c1", "c2"])
    expect(Object.keys(cleaned)).not.toContain("variant")
  })
  test("a broken leaf component degrades to a Text placeholder", () => {
    const cleaned = sanitizeComponent({ id: "x", component: "Card", foo: 1 })
    expect(cleaned.component).toBe("Text")
    expect(String(cleaned.text)).toContain("Card")
  })
})
describe("the exact Card misuse seen live (agent surface #6)", () => {
  test("parse keeps the surface valid: Card with variant/children is degraded, content survives", () => {
    const spec = JSON.stringify([
      { version: "v0.9", createSurface: { surfaceId: "main", catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json" } },
      { version: "v0.9", updateComponents: {
        surfaceId: "main",
        components: [
          { id: "card1", component: "Card", variant: "outline", children: ["c1title", "c1meta"] },
          { id: "c1title", component: "Text", text: "阅读第 1 章" },
          { id: "c1meta", component: "Text", text: "截止：周五" }
        ]
      } }
    ])
    const result = parseA2uiBatch(spec)
    expect(result.error).toBeUndefined()
    const all: Array<Record<string, unknown>> = []
    for (const m of result.messages) {
      if ("updateComponents" in m) all.push(...(m.updateComponents.components as Array<Record<string, unknown>>))
    }
    // no Card survives with illegal variant/children
    const cards = all.filter((c) => c.component === "Card")
    expect(cards.length).toBe(0)
    // the container degraded to a Column that still references its content (and became the tree root)
    const column = all.find((c) => c.component === "Column" && c.id === "root")
    expect(column).toBeDefined()
    expect((column as Record<string, unknown>).children).toEqual(["c1title", "c1meta"])
    // a valid root exists so the renderer is not stuck at Loading root
    expect(all.some((c) => c.id === "root")).toBe(true)
  })
})
describe("sanitize targeted repairs (habits seen live on the dashboard)", () => {
  test("TextField with the invalid variant enum 'text' survives as shortText form", () => {
    const cleaned = sanitizeComponent({ id: "in", component: "TextField", label: "搜索", variant: "text", value: { path: "/f/q" } })
    expect(cleaned.component).toBe("TextField")
    expect(cleaned.variant).toBeUndefined() // invalid enum dropped, props survive
    expect((cleaned as Record<string, unknown>).value).toEqual({ path: "/f/q" })
  })
  test("Button action without the event wrapper is wrapped", () => {
    const cleaned = sanitizeComponent({ id: "go", component: "Button", child: "bl", action: { name: "refresh", context: { t: 1 } } })
    expect(cleaned.component).toBe("Button")
    const action = (cleaned as Record<string, unknown>).action as { event: { name: string; context: unknown } }
    expect(action.event.name).toBe("refresh")
    expect(action.event.context).toEqual({ t: 1 })
  })
  test("Image src is renamed to the official url key", () => {
    const cleaned = sanitizeComponent({ id: "pic", component: "Image", src: "https://x/y.png", description: "logo" })
    expect(cleaned.component).toBe("Image")
    const out = cleaned as Record<string, unknown>
    expect(out.url).toBe("https://x/y.png")
    expect(out.src).toBeUndefined()
  })
  test("Card with a SINGLE child id promotes it to the required child", () => {
    const cleaned = sanitizeComponent({ id: "c", component: "Card", children: ["inner1"] })
    expect(cleaned.component).toBe("Card")
    expect((cleaned as Record<string, unknown>).child).toBe("inner1")
  })
  test("Card with MANY children degrades to Column so no content is dropped", () => {
    const cleaned = sanitizeComponent({ id: "c", component: "Card", children: ["a", "b"] })
    expect(cleaned.component).toBe("Column")
    expect((cleaned as Record<string, unknown>).children).toEqual(["a", "b"])
  })
  test("unfixable components degrade to a Text that names the zod reason", () => {
    const cleaned = sanitizeComponent({ id: "w", component: "Button", action: { event: 5 }, text: "hi" })
    expect(cleaned.component).toBe("Text")
    expect(String((cleaned as Record<string, unknown>).text)).toContain("action")
    expect(String((cleaned as Record<string, unknown>).text)).toContain("hi")
  })
})
