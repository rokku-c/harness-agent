import type { EffectApp } from "@effect-agent/effect-interface"
import type { EffectAppDescriptor } from "../descriptor.ts"

export const launcherApps = (app: EffectAppDescriptor): readonly EffectApp[] =>
  app.path === undefined ? [] : [{
    id: "console", title: app.title ?? app.id, path: app.path, resourceUri: `ui://${app.id}/console`,
    ...(app.icon === undefined ? {} : { icon: app.icon }),
    ...(app.color === undefined ? {} : { color: app.color }),
  }]
