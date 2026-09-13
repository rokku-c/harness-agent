import type { EffectAppDescriptor, EffectAppHost } from "../descriptor.ts"
import { revocable } from "@effect-agent/effect-interface"
import { viewSpecSchema } from "@effect-agent/effect-ui"
import { launcherApps } from "./launcher.ts"
import type { Cleanup } from "./disposal.ts"

export const registerMetadata = (host: EffectAppHost, app: EffectAppDescriptor, steps: Cleanup[]): void => {
  if (host.uiViews !== undefined && app.ui !== undefined) {
    viewSpecSchema().parse(app.ui)
    steps.push(revocable(host.uiViews, app.id, app.ui))
  }
  if (host.registry !== undefined && (app.tools !== undefined || app.path !== undefined)) {
    steps.push(host.registry.registerInterface({
      id: app.id,
      title: app.title ?? app.id,
      description: app.description,
      tools: (app.tools ?? []) as never,
      apps: launcherApps(app),
    }))
  }
}
