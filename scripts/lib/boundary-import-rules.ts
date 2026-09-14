import { posix } from "node:path"
import { importSpecifiers, isBuiltinSpecifier } from "./import-scan.ts"
import { escapeAllowed, fileAllowed, ioExempt, type BoundaryConfig } from "./boundary-config.ts"
import type { Finding } from "./boundary-finding.ts"
import type { Pkg } from "./package-graph.ts"

export interface ImportContext {
  readonly config: BoundaryConfig
  readonly byName: ReadonlyMap<string, Pkg>
  readonly fileRel: string
}

export const importFindings = (pkg: Pkg, source: string, ctx: ImportContext): Finding[] => {
  const findings: Finding[] = []
  const fileRel = ctx.fileRel
  const dirRel = posix.dirname(fileRel)
  for (const spec of importSpecifiers(source)) {
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
    const rest = spec.slice(workspace.length + 1)
    const target = ctx.byName.get(workspace)
    if (target === undefined) continue

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
