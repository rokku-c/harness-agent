/**
 * A placement: an artifact at an address inside a node (§8.1, §8.4).
 *
 * `nodes.ts` owns the *what* — a node's whole expected set; this file owns the
 * *where* — one instance of one artifact at one namespace, and the identity that
 * comes from the two together (`ns::bundleId@version`, §8.2). The validator here
 * is deliberately thin: it hands the artifact-shaped fields to
 * `bundle-artifact.ts`, so both ABI lines have one reader, and checks only what
 * is placement-specific — the namespace, and that the slot holds an app.
 */

import { bundleRuntimes } from "@effect-agent/effect-bundle"
import { artifactOf, validateBundleArtifact, type BundleArtifact } from "./bundle-artifact.ts"
import { bundleRefId } from "./bundles.ts"
import { fail, nonEmpty, record, sameKeys } from "./guards.ts"
import type { ResolvedNodeApp } from "./node-types.ts"
import type { BundleRef } from "./types.ts"

/** `ops::board@1.0.0` — a *placement*, which is what a node holds. */
export const nodeAppId = (app: Pick<ResolvedNodeApp, "ns" | "bundleId" | "version">): string =>
  `${app.ns}::${bundleRefId(app)}`

/** An app artifact as placed on a node: the artifact, plus where it sits. */
export interface NodeAppArtifact extends BundleArtifact {
  readonly ns: string
  /** Absent = enabled. */
  readonly enabled?: boolean
}

const APP_KEYS = ["bundleId", "version", "abi", "runtimes", "ns"]
/** Optional fields are optional in the key set too — `kind: "app"` is the default. */
const appKeys = (app: Record<string, unknown>): readonly string[] => [
  ...APP_KEYS,
  ...(app.kind === undefined ? [] : ["kind"]),
  ...(app.enabled === undefined ? [] : ["enabled"]),
]

export const validateNodeApp = (value: unknown): NodeAppArtifact => {
  const app: Record<string, unknown> = record(value) ? value : fail("invalid node app")
  // Validate as an artifact first, so the two ABI lines and the runtime set are
  // adjudicated by the same code the agent-level adapter uses. `ns`/`enabled`
  // are stripped because they are *placement* facts: the artifact validator's
  // job is the artifact, and handing it keys it does not know would make every
  // placement look malformed. `runtimes` is filled from the same default
  // `artifactOf` uses, so a placement that omits it means what a ref means.
  const artifact = validateBundleArtifact({
    bundleId: app.bundleId,
    version: app.version,
    abi: app.abi,
    kind: app.kind ?? "app",
    runtimes: app.runtimes ?? bundleRuntimes(app as unknown as BundleRef),
    ...(app.bootstrapAbi === undefined ? {} : { bootstrapAbi: app.bootstrapAbi }),
  })
  // A kernel in an app slot is the mirror of an app in the kernel slot, and both
  // are category errors rather than compatibility verdicts.
  if (artifact.kind !== "app") fail("a node app placement must be an app artifact, not a kernel")
  if (!nonEmpty(app.ns) || /\s/.test(app.ns)) fail("invalid node app namespace")
  if (!sameKeys(app, appKeys(app))) fail("invalid node app")
  if (app.enabled !== undefined && typeof app.enabled !== "boolean") fail("invalid node app enabled")
  return { ...artifact, ns: app.ns, ...(app.enabled === undefined ? {} : { enabled: app.enabled }) }
}

/** A resolved placement as the node is handed it: the artifact plus its address. */
export const placementOf = (app: ResolvedNodeApp): NodeAppArtifact => ({
  ...artifactOf(app),
  ns: app.ns,
  ...(app.enabled === undefined ? {} : { enabled: app.enabled }),
})
