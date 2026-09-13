/**
 * R1-R4 and W: the import rules, applied to one file's source.
 *
 * Specifiers are visited in source order and the first rule that fires ends
 * that specifier, so the report reads top-to-bottom like the source does.
 */

import { posix } from "node:path"
import { importSpecifiers, isBuiltinSpecifier } from "./import-scan.ts"
import { escapeAllowed, fileAllowed, ioExempt, type BoundaryConfig } from "./boundary-config.ts"
import type { Finding } from "./boundary-finding.ts"
import type { Pkg } from "./package-graph.ts"

export interface ImportContext {
  readonly config: BoundaryConfig
  readonly byName: ReadonlyMap<string, Pkg>
  /** repo-relative, posix */
  readonly fileRel: string
}

export const importFindings = (pkg: Pkg, source: string, ctx: ImportContext): Finding[] => {
  const findings: Finding[] = []
  const fileRel = ctx.fileRel
  const dirRel = posix.dirname(fileRel)
  for (const spec of importSpecifiers(source)) {
    // R1 no relative import that escapes the package root
    if (spec.startsWith(".")) {
      const resolved = posix.normalize(posix.join(dirRel, spec))
      if (resolved !== pkg.dir && !resolved.startsWith(pkg.dir + "/") && !escapeAllowed(ctx.config, pkg, resolved)) {
        findings.push({
          severity: "error",
          rule: "R1-escape",
          file: fileRel,
          specifier: spec,
          message: `relative import escapes ${pkg.dir}: -> ${resolved}`,
        })
      }
      continue
    }
    // R4 apps must not use bun/node builtins — go through repo abstractions
    if (isBuiltinSpecifier(spec)) {
      if (pkg.kind === "app" && !ioExempt(ctx.config, pkg) && !fileAllowed(ctx.config.allowNodeBuiltinsFrom, fileRel)) {
        findings.push({
          severity: "error",
          rule: "R4-builtin",
          file: fileRel,
          specifier: spec,
          message: `app ${pkg.dir} imports a system builtin (${spec}); use the repo's abstraction packages instead`,
        })
      }
      continue
    }

    const name = spec.split("/")[0]
    const workspace = name.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : name
    const rest = spec.slice(workspace.length + 1) // "" when importing the package root
    const target = ctx.byName.get(workspace)
    if (target === undefined) continue // third-party npm — out of scope

    // R2 deep import (apps must import package roots; packages: warn)
    if (rest !== "" && !ctx.config.allowDeepWorkspaceImports?.includes(spec)) {
      findings.push({
        severity: pkg.kind === "app" ? "error" : "warn",
        rule: "R2-deep",
        file: fileRel,
        specifier: spec,
        message: `deep import into ${workspace}; import the package root only`,
      })
      continue
    }

    // R3 app -> app (apps must use repo abstractions instead)
    if (pkg.kind === "app" && target.kind === "app") {
      if (!fileAllowed(ctx.config.allowCrossAppImports, fileRel)) {
        findings.push({
          severity: "error",
          rule: "R3-cross-app",
          file: fileRel,
          specifier: spec,
          message: `app ${pkg.dir} imports app ${target.dir} directly; use the exported interface/abstraction instead`,
        })
      }
    }

    // W undeclared workspace dependency
    if (!pkg.deps.has(workspace)) {
      findings.push({
        severity: "warn",
        rule: "W-undeclared",
        file: fileRel,
        specifier: spec,
        message: `workspace import "${workspace}" is not declared in ${pkg.dir}/package.json`,
      })
    }
  }
  return findings
}
