/**
 * What a compiled artifact leaves to the host it runs on.
 *
 * Both kinds of artifact are built with the same set external, and for the same
 * reason: an app talks to its host through the `effect-N` interfaces, and a kernel
 * talks to its host through `bootstrap-N`. Bundling either one in would give the
 * artifact its own private copy of the ABI, which is precisely the thing the two
 * lines exist to pin — the artifact would then run against an interface nobody
 * checked.
 *
 * The consequence is real and worth stating: an artifact only loads where the
 * host can resolve these, so it is staged *within* the host's module graph rather
 * than dropped somewhere arbitrary.
 */

export const BUNDLE_EXTERNALS = ["@effect-agent/*", "zod", "react", "react-dom"] as const
