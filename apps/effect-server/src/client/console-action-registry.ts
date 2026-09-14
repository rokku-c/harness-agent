/**
 * The actions of the app that is on screen, so the palette can run one of them.
 *
 * §6.4's Actions group is the only group whose Enter does something rather than
 * going somewhere, and it is the only one that cannot be built from a payload: a
 * declared action is a function of the view's own store and of the screen it was
 * declared on, and the mounted view is the only thing that has either. So the
 * view registers what it can run while it is mounted, and the group offers
 * exactly that — never a list read from a payload, which would be a row that
 * could be run for an app whose view is not on screen and whose store the console
 * therefore does not have.
 *
 * The app id is part of the registration and is checked again on the way out, so
 * a press that arrives during the moment between one app unmounting and the next
 * mounting cannot run the wrong app's action. There is one slot because one app
 * is mounted at a time: the shell draws one surface.
 */

import type { Params } from "./effect-ui-action-call.ts"

export type ActionRun = (params?: Params) => Promise<unknown>

let mounted: { readonly app: string; readonly handlers: Readonly<Record<string, ActionRun>> } | null = null

export const setMountedActions = (app: string, handlers: Readonly<Record<string, ActionRun>>): void => {
  mounted = { app, handlers }
}

export const clearMountedActions = (app: string): void => {
  if (mounted?.app === app) mounted = null
}

/** Runs one declared action of the mounted app, and does nothing at all for any other. */
export const runMountedAction = (app: string, name: string): void => {
  if (mounted === null || mounted.app !== app) return
  // No arguments: §6.4 rule 2 gives this group only the actions that take none, and
  // an action that reads its values from state reads them from the view's own store.
  void mounted.handlers[name]?.({})
}
