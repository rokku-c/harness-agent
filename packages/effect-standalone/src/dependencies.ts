import type { EffectAppDescriptor } from "@effect-agent/effect-apps"

export const dependencyGaps = (app: EffectAppDescriptor, hosted: readonly string[]): readonly string[] =>
  (app.requires ?? []).filter((id) => id !== app.id && !hosted.includes(id))

export const dependencyError = (app: EffectAppDescriptor, missing: readonly string[]): Error =>
  new Error(`app "${app.id}" requires ${missing.join(", ")} — this host registers one app, so hosting it alone `
    + `would serve a face that cannot work. Host the apps that provide these together (the composition root, `
    + `apps/effect-server, boots the declared set).`)
