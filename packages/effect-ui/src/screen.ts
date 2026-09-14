import type { EffectUiView, UiNode } from "./spec.ts"
import type { UiScreen } from "./screen-spec.ts"
import { deriveScreens } from "./screen-derive.ts"

export const ROOT_SCREEN = "root"

export const NAV_ROOT = "/_nav"

const rootScreen = (view: EffectUiView, nodes: readonly UiNode[]): UiScreen =>
  ({ id: ROOT_SCREEN, title: view.title ?? view.viewId, nodes })

export const screensOf = (view: EffectUiView): readonly UiScreen[] => {
  const derived = view.screens === undefined ? deriveScreens(view, [ROOT_SCREEN]) : undefined
  return [rootScreen(view, derived?.lead ?? view.nodes), ...(view.screens ?? derived?.screens ?? [])]
}

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
