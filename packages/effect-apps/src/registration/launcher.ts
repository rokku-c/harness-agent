import type { EffectApp } from "@effect-agent/effect-interface"
import type { EffectAppDescriptor } from "../descriptor.ts"

/**
 * How this app appears in a host's launcher.
 *
 * Both registration paths build it here — the metadata pass, and the plane a
 * plugin loads — because the registry keys interfaces by id: whichever of the
 * two registers last is the one a launcher reads. Built in two places, an app
 * kept its mark in one path and lost it in the other, which is a bug that only
 * shows on the apps that happen to have tools.
 */
export const launcherApps = (app: EffectAppDescriptor): readonly EffectApp[] =>
  app.path === undefined ? [] : [{
    id: "console", title: app.title ?? app.id, path: app.path, resourceUri: `ui://${app.id}/console`,
    ...(app.icon === undefined ? {} : { icon: app.icon }),
    ...(app.color === undefined ? {} : { color: app.color }),
  }]
