import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { matches } from "./glob-match.ts"
import type { Pkg } from "./package-graph.ts"

export interface BoundaryConfig {
  allowEscapeTo?: Array<{ from: string; to: string[] }>
  allowDeepWorkspaceImports?: string[]
  allowCrossAppImports?: string[]
  ioExemptApps?: string[]
  allowNodeBuiltinsFrom?: string[]
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

export const fileAllowed = (list: readonly string[] | undefined, fileRel: string): boolean =>
  (list ?? []).some((p) => matches(p, fileRel))
