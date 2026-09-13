import type { EffectAppDescriptor } from "@effect-agent/effect-apps"

/**
 * "This app does not depend on other apps" is only a fact if something can
 * decide it. `requires` was declared and read by nothing, so the claim was
 * unverifiable — which is how an app comes to "start alone" with a face quietly
 * missing. The computable form is a set difference: what the app declares
 * against what the host actually hosts. This host hosts one app, so every
 * declared requirement other than the app itself is a gap.
 */
export const dependencyGaps = (app: EffectAppDescriptor, hosted: readonly string[]): readonly string[] =>
  (app.requires ?? []).filter((id) => id !== app.id && !hosted.includes(id))

export const dependencyError = (app: EffectAppDescriptor, missing: readonly string[]): Error =>
  new Error(`app "${app.id}" requires ${missing.join(", ")} — this host registers one app, so hosting it alone `
    + `would serve a face that cannot work. Host the apps that provide these together (the composition root, `
    + `apps/effect-server, boots the declared set).`)
