/**
 * effect-ui renderer seam — the swap point.
 *
 * An app renders an EffectUiView through a UiRenderer chosen by id, never
 * through a concrete implementation. Swapability is demonstrated by the two
 * renderers shipped in this package (html-renderer, web-bridge).
 */

import type { EffectUiView } from "./spec.ts"

export interface UiRenderer {
  readonly id: string
  render(view: EffectUiView): string
}

export interface UiRendererRegistry {
  register(renderer: UiRenderer): void
  get(id: string): UiRenderer | undefined
  list(): ReadonlyArray<string>
  /** Pick a renderer by id and render a view; throws when the id is unknown. */
  render(id: string, view: EffectUiView): string
}

export const makeUiRendererRegistry = (initial: ReadonlyArray<UiRenderer> = []): UiRendererRegistry => {
  const renderers = new Map(initial.map((renderer) => [renderer.id, renderer]))
  return {
    register: (renderer) => {
      renderers.set(renderer.id, renderer)
    },
    get: (id) => renderers.get(id),
    list: () => [...renderers.keys()],
    render: (id, view) => {
      const renderer = renderers.get(id)
      if (renderer === undefined) throw new Error("ui renderer not found: " + id)
      return renderer.render(view)
    },
  }
}
