import { screensOf, viewToJsonSpec } from "@effect-agent/effect-ui"
import type { EffectUiView, UiScreen } from "@effect-agent/effect-ui"
import type { ConsoleOptions } from "./options.ts"

const payload = (view: EffectUiView, screen: UiScreen) => ({
  id: screen.id,
  title: screen.title,
  ...(screen.parent === undefined ? {} : { parent: screen.parent }),
  ...(screen.onEnter === undefined ? {} : { onEnter: screen.onEnter }),
  spec: viewToJsonSpec({ ...view, nodes: screen.nodes }),
})

export const viewRoute = (options: ConsoleOptions, id: string): Response => {
  const view = options.uiViews?.get(id)
  if (view === undefined) {
    return Response.json({ kind: "none", id, detail: `"${id}" declares no view` }, { status: 404 })
  }
  const screens = screensOf(view)
  return Response.json({ kind: "view", id, view,
    screens: screens.map((screen) => payload(view, screen)),
    menu: view.screens === undefined && screens.length > 1,
  })
}
