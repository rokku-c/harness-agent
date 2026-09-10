import { expect, test } from "bun:test"
import { composeStyleLayers, injectStyleLayers, type StyleLayer } from "../src/style-layer.ts"

const layer = (id: string, cssText: string, order?: number): StyleLayer => ({ id, cssText, order })

test("style composition keeps layer order and last declaration per stable id", () => {
  const css = composeStyleLayers([
    layer("shell", "shell", 20), layer("base", "base", 0), layer("shell", "replacement", 10),
  ])
  expect(css).toBe("base\nreplacement")
})

test("style injection updates one stable node and removes duplicate nodes", () => {
  const nodes: any[] = []
  const head = {
    querySelectorAll: () => nodes,
    append: (node: any) => { node.parentNode = head; nodes.push(node) },
  }
  const doc = {
    head,
    createElement: () => ({ dataset: {}, textContent: "", parentNode: null, remove() { nodes.splice(nodes.indexOf(this), 1) },
      after(node: any) { const index = nodes.indexOf(this); nodes.splice(nodes.indexOf(node), 1); nodes.splice(index + 1, 0, node) },
      get previousElementSibling() { return nodes[nodes.indexOf(this) - 1] ?? null },
    }),
  } as unknown as Document
  injectStyleLayers(doc, [layer("base", "new", 0), layer("shell", "shell", 1)])
  injectStyleLayers(doc, [layer("base", "updated", 0), layer("shell", "shell", 1)])
  expect(nodes.map(node => [node.dataset.styleLayer, node.textContent])).toEqual([["base", "updated"], ["shell", "shell"]])
})
