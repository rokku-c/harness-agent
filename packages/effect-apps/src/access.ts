import type { AppEntry, AppsPlane } from "./catalog.ts"

export const canAccessAppPlane = (app: AppEntry, plane: AppsPlane): boolean =>
  app.authorize?.(plane) === true

export const requireAppPlane = (app: AppEntry, plane: AppsPlane): void => {
  if (!canAccessAppPlane(app, plane)) {
    throw new Error(`effect-apps: denied — ${app.ns}::${app.appId}.${plane}`)
  }
}
