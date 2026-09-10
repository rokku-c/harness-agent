export interface StyleLayer {
  readonly id: string
  readonly cssText: string
  readonly order?: number
}

type OrderedLayer = StyleLayer & { readonly index: number }

const normalize = (layers: readonly StyleLayer[]): StyleLayer[] => {
  const unique = new Map<string, OrderedLayer>()
  layers.forEach((layer, index) => unique.set(layer.id, { ...layer, index }))
  return [...unique.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.index - b.index)
    .map(({ index: _index, ...layer }) => layer)
}

export const composeStyleLayers = (layers: readonly StyleLayer[]): string =>
  normalize(layers).map(layer => layer.cssText).join("\n")

const nodesFor = (doc: Document, id: string): HTMLStyleElement[] =>
  Array.from(doc.head.querySelectorAll<HTMLStyleElement>("style[data-style-layer]")).filter(
    node => node.dataset.styleLayer === id,
  )

export const injectStyleLayers = (doc: Document, layers: readonly StyleLayer[]): void => {
  let previous: HTMLStyleElement | null = null
  for (const layer of normalize(layers)) {
    const matches = nodesFor(doc, layer.id)
    const node = matches[0] ?? doc.createElement("style")
    node.dataset.styleLayer = layer.id
    node.textContent = layer.cssText
    if (!node.parentNode) doc.head.append(node)
    matches.slice(1).forEach(duplicate => duplicate.remove())
    if (previous && node.previousElementSibling !== previous) previous.after(node)
    previous = node
  }
}
