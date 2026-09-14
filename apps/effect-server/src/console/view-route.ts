import { screensOf, viewToJsonSpec } from "@effect-agent/effect-ui"
import type { EffectUiView, UiScreen } from "@effect-agent/effect-ui"
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
  ...(screen.onEnter === undefined ? {} : { onEnter: screen.onEnter }),
  spec: viewToJsonSpec({ ...view, nodes: screen.nodes }),
})

/**
 * What an app's view address draws: the app's own declarative view, or nothing.
 *
 * This used to answer with the tool inspector when an app registered MCP and drew
 * nothing, which meant one address rendering one of two unrelated surfaces
 * depending on what an app happened to register — and an app with both a view and
 * operations losing the operations entirely (`flows.md` §1.6, verified in
 * source). A view address is a view now, and operations are the Tools place's,
 * which every app that registered any is inspectable at whether or not it draws.
 *
 * An app with no view is a 404 rather than a redirect: the client renders Not
 * found at the address that was asked for, and offers the addresses that do exist
 * for that app (§2.H8, §2.H13).
 *
 * The screens arrive lowered and in order, the first one being where the app
 * starts. Which of them is on top is the address bar's business, not this
 * response's, so the same payload serves every screen of the app; `menu` says
 * whether the first one has to offer the rest, which is true exactly when the
 * host read them off the layout instead of being told.
 */
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
