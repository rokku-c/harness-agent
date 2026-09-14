import type { Params } from "./effect-ui-action-call.ts"

export type ActionRun = (params?: Params) => Promise<unknown>

let mounted: { readonly app: string; readonly handlers: Readonly<Record<string, ActionRun>> } | null = null

export const setMountedActions = (app: string, handlers: Readonly<Record<string, ActionRun>>): void => {
  mounted = { app, handlers }
}

export const clearMountedActions = (app: string): void => {
  if (mounted?.app === app) mounted = null
}

export const runMountedAction = (app: string, name: string): void => {
  if (mounted === null || mounted.app !== app) return
  void mounted.handlers[name]?.({})
}
