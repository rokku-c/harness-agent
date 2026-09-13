/**
 * effect.boundary.json — the grandfathered allowlists the rules consult.
 *
 * A missing file is an empty config: nothing is allowed, so the rules report
 * against the strict baseline rather than silently skipping everything.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { matches } from "./glob-match.ts"
import type { Pkg } from "./package-graph.ts"

export interface BoundaryConfig {
  allowEscapeTo?: Array<{ from: string; to: string[] }>
  allowDeepWorkspaceImports?: string[]
  allowCrossAppImports?: string[]
  /** legacy system/connector apps that may still use fs/network/env directly (TODO: refactor into abstractions) */
  ioExemptApps?: string[]
  /** legacy app files that may still use node:/bun: builtins (TODO: move into abstraction packages) */
  allowNodeBuiltinsFrom?: string[]
  /** legacy app files that may still touch fs/network directly (TODO: refactor to abstractions) */
  allowSystemIoFrom?: string[]
}

export const loadBoundaryConfig = (root: string): BoundaryConfig =>
  existsSync(join(root, "effect.boundary.json"))
    ? (JSON.parse(readFileSync(join(root, "effect.boundary.json"), "utf8")) as BoundaryConfig)
    : {}

export const ioExempt = (config: BoundaryConfig, pkg: Pkg): boolean =>
  (config.ioExemptApps ?? []).includes(pkg.name)

export const escapeAllowed = (config: BoundaryConfig, pkg: Pkg, target: string): boolean =>
  (config.allowEscapeTo ?? []).some((a) => matches(a.from, pkg.dir) && a.to.some((t) => matches(t, target)))

/** Whether a repo-relative file matches any pattern in an allowlist. */
export const fileAllowed = (list: readonly string[] | undefined, fileRel: string): boolean =>
  (list ?? []).some((p) => matches(p, fileRel))
