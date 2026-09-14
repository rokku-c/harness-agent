import { bundleRuntimes } from "@effect-agent/effect-bundle"
import { artifactOf, validateBundleArtifact, type BundleArtifact } from "./bundle-artifact.ts"
import { bundleRefId } from "./bundles.ts"
import { fail, nonEmpty, record, sameKeys } from "./guards.ts"
import type { ResolvedNodeApp } from "./node-types.ts"
import type { BundleRef } from "./types.ts"

export const nodeAppId = (app: Pick<ResolvedNodeApp, "ns" | "bundleId" | "version">): string =>
  `${app.ns}::${bundleRefId(app)}`

export interface NodeAppArtifact extends BundleArtifact {
  readonly ns: string
  readonly enabled?: boolean
}

const APP_KEYS = ["bundleId", "version", "abi", "runtimes", "ns"]
const appKeys = (app: Record<string, unknown>): readonly string[] => [
  ...APP_KEYS,
  ...(app.kind === undefined ? [] : ["kind"]),
  ...(app.enabled === undefined ? [] : ["enabled"]),
]

export const validateNodeApp = (value: unknown): NodeAppArtifact => {
  const app: Record<string, unknown> = record(value) ? value : fail("invalid node app")
  const artifact = validateBundleArtifact({
    bundleId: app.bundleId,
    version: app.version,
    abi: app.abi,
    kind: app.kind ?? "app",
    runtimes: app.runtimes ?? bundleRuntimes(app as unknown as BundleRef),
    ...(app.bootstrapAbi === undefined ? {} : { bootstrapAbi: app.bootstrapAbi }),
  })
  if (artifact.kind !== "app") fail("a node app placement must be an app artifact, not a kernel")
  if (!nonEmpty(app.ns) || /\s/.test(app.ns)) fail("invalid node app namespace")
  if (!sameKeys(app, appKeys(app))) fail("invalid node app")
  if (app.enabled !== undefined && typeof app.enabled !== "boolean") fail("invalid node app enabled")
  return { ...artifact, ns: app.ns, ...(app.enabled === undefined ? {} : { enabled: app.enabled }) }
}

export const placementOf = (app: ResolvedNodeApp): NodeAppArtifact => ({
  ...artifactOf(app),
  ns: app.ns,
  ...(app.enabled === undefined ? {} : { enabled: app.enabled }),
})
