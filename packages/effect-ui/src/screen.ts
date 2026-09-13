/**
 * How many screens a view has, and where an entered screen's parameters live.
 *
 * The host asks one question — `screensOf` — and gets the whole answer: `nodes`
 * is always the screen the app starts on, and the rest are the screens the view
 * declared or the ones that can be read off it (screen-derive.ts). Nothing else
 * in the package has an opinion about screens, which is why a renderer that has
 * never heard of them still renders a view correctly: it renders `nodes`, and
 * `nodes` is the first screen.
 *
 * An action that enters a screen carries parameters, and they land under
 * `/_nav/<name>` — the reserved-root arrangement source status already uses
 * (`source-status.ts:38`), for the same reason. A screen reads them with the
 * language's ordinary `{ state: ... }`, so entering a screen needs no third way
 * to say where a value comes from.
 */

import type { EffectUiView, UiNode, UiScreen } from "./spec.ts"
import { deriveScreens } from "./screen-derive.ts"

/** The first screen's id. Reserved: `nodes` is that screen, and no view names it. */
export const ROOT_SCREEN = "root"

/** The reserved root an entered screen's parameters live under. */
export const NAV_ROOT = "/_nav"

/** Where an entered screen's parameters are read from. Paths here are the runtime's, not a view's. */
export const navParam = (name: string): string => `${NAV_ROOT}/${name}`

/** The screen the app starts on, titled for the host's navigation bar. */
const rootScreen = (view: EffectUiView, nodes: readonly UiNode[]): UiScreen =>
  ({ id: ROOT_SCREEN, title: view.title ?? view.viewId, nodes })

/**
 * Every screen of a view, the one it starts on first. A declared list is the
 * whole answer: reading screens off a view that stated them would be a second
 * opinion about the view's own shape.
 */
export const screensOf = (view: EffectUiView): readonly UiScreen[] => {
  const derived = view.screens === undefined ? deriveScreens(view) : undefined
  return [rootScreen(view, derived?.lead ?? view.nodes), ...(view.screens ?? derived?.screens ?? [])]
}

/** The screen an id names, or `undefined` — a link to a screen that is gone lands where the caller says. */
export const screenById = (screens: readonly UiScreen[], id: string | undefined): UiScreen | undefined =>
  screens.find((screen) => screen.id === id)

/**
 * The screens from the first one down to `id`, for a link that arrived cold:
 * a destination reached by URL has no stack behind it, and the stack a back
 * control pops is rebuilt from what each screen says its parent is.
 *
 * A screen that is its own ancestor ends the walk rather than spinning — a
 * view's `parent` fields are data, and data can be wrong. The walk reads only an
 * id and a parent, so a host can hand it its own screen record rather than
 * reassembling one.
 */
export const chainOf = <T extends { readonly id: string; readonly parent?: string }>(screens: readonly T[], id: string): readonly T[] => {
  const byId = new Map(screens.map((screen) => [screen.id, screen]))
  const chain: T[] = []
  const seen = new Set<string>()
  let cursor: string | undefined = id
  while (cursor !== undefined && !seen.has(cursor)) {
    seen.add(cursor)
    const screen = byId.get(cursor)
    if (screen === undefined) break
    chain.unshift(screen)
    cursor = screen.parent ?? (screen.id === ROOT_SCREEN ? undefined : ROOT_SCREEN)
  }
  return chain
}
