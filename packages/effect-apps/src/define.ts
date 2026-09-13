import type { EffectAppDescriptor } from "./descriptor.ts"

export const defineApp = (app: EffectAppDescriptor): EffectAppDescriptor => {
  if (app.routes !== undefined || app.path === undefined) return app
  const path = app.path.length > 1 && app.path.endsWith("/") ? app.path.slice(0, -1) : app.path
  return { ...app, routes: [{ path, match: "prefix" }] }
}
