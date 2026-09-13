import { screensOf, viewToJsonSpec } from "@effect-agent/effect-ui"
import type { EffectUiView, UiScreen } from "@effect-agent/effect-ui"
import { inspectorTools } from "./tools-route.ts"
import type { ConsoleOptions } from "./options.ts"

/**
 * One screen, lowered on its own. A spec's element ids are a flat namespace, so
 * lowering a view once and handing the client a way to pick a subtree out of it
 * would collide the moment two screens had a node without an id of its own.
 */
const payload = (view: EffectUiView, screen: UiScreen) => ({
  id: screen.id,
  title: screen.title,
  ...(screen.parent === undefined ? {} : { parent: screen.parent }),
  spec: viewToJsonSpec({ ...view, nodes: screen.nodes }),
})

/**
 * What the console should mount for an app id: the app's own declarative view
 * when it declared one, else the tool inspector when it registered tools, else
 * nothing to draw. Deciding here — where the registry is — keeps the client
 * from asking twice, and keeps "this app has no surface" a single answer.
 *
 * The screens arrive lowered and in order, the first one being where the app
 * starts. Which of them is on top is the address bar's business, not this
 * response's, so the same payload serves every screen of the app; `menu` says
 * whether the first one has to offer the rest, which is true exactly when the
 * host read them off the layout instead of being told.
 */
export const viewRoute = (options: ConsoleOptions, id: string): Response => {
  const view = options.uiViews?.get(id)
  if (view !== undefined) {
    const screens = screensOf(view)
    return Response.json({ kind: "view", id, view, languages: ["effect-ui", "json-render"],
      screens: screens.map((screen) => payload(view, screen)),
      menu: view.screens === undefined && screens.length > 1,
    })
  }
  const tools = inspectorTools(options.registry, id)
  if (tools.length > 0) {
    return Response.json({ kind: "tools", id, title: options.registry.find(id)?.title ?? id, tools })
  }
  return Response.json({ kind: "none", id, detail: "no declarative description" }, { status: 404 })
}
