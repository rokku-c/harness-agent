/**
 * One screen: the shape, which `screen.ts` then answers questions about.
 *
 * Kept apart from the node vocabulary it is built from, because a screen is the
 * unit navigation moves between — a link names one, a press enters one, a back
 * control leaves one — and a node never does any of those.
 */

import type { UiNode } from "./spec.ts"

/**
 * One screen a view can be entered at: Android's Activity, iOS's view
 * controller.
 *
 * A view is a tool surface, and a tool has functions — a fleet and the agent you
 * picked out of it, a board and the task you opened. `nodes` is the screen the
 * app starts on; these are the ones you enter from it, by a declared action that
 * says `opens` (see data-spec.ts). A screen is the same node vocabulary as any
 * other: nothing here is a second way to write a view.
 */
export interface UiScreen {
  readonly id: string
  readonly title: string
  /**
   * The screen a back control returns to. Absent means the one the app starts
   * on, so a screen entered straight from there says nothing. It is declared for
   * the chain — a log opened from an agent opened from a fleet — and its other
   * use is a link that arrived cold: the host rebuilds the stack from it.
   */
  readonly parent?: string
  /**
   * The action that fills this screen, run once when it becomes the one on top.
   *
   * A destination has to be complete on arrival. A press that enters a screen can
   * read the record first — that is what `opens` beside `url` is for — but a link
   * pasted into the address bar has no press behind it, so it arrived at a screen
   * with nothing in it: the parameters were in the address and read by nobody.
   *
   * Naming the action here is what makes the two the same path. The host runs it
   * after the screen's parameters are in the store, so an action that reads them
   * from `/_nav/...` is handed exactly what a press would have supplied at
   * runtime, and a press that already ran it finds nothing left to do.
   */
  readonly onEnter?: string
  readonly nodes: readonly UiNode[]
}
