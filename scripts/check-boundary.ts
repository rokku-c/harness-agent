/**
 * Import-boundary checker.
 *
 * Enforces that apps/packages only touch each other through repo abstractions:
 *   R1 no relative import that escapes its own package root
 *      (cross-package goes through the workspace package name)
 *   R2 no deep import into a workspace package ("@effect-agent/x/src/…") —
 *      only the package's root export "."
 *   R3 an app must not import another app's internals; reach other apps only
 *      via exported interface contracts / effect-host / the package's export
 *   W  workspace imports should be declared in the importer's dependencies
 *
 * Allowances live in ./effect.boundary.json (composer roots that may load app
 * plugin modules, etc.). Exit code 1 on any R violation; --strict also fails on W.
 *
 *   bun scripts/check-boundary.ts [--strict]
 */

import { readFileSync, existsSync } from "node:fs"
import { join, posix, resolve, sep } from "node:path"
import {
  collectPackages,
  importSpecifiers,
  isBuiltinSpecifier,
  matches,
  scanSystemIo,
  sourceFiles,
  type Pkg,
} from "./lib/source-scan.ts"

const ROOT = resolve(import.meta.dir, "..")
const STRICT = process.argv.includes("--strict")

const PKGS: Pkg[] = [...collectPackages(ROOT, "apps", "app"), ...collectPackages(ROOT, "packages", "package")]
const byName = new Map(PKGS.map((p) => [p.name, p]))

const files = (srcDir: string): string[] => sourceFiles(ROOT, srcDir)

const posixOf = (p: string): string => p.split(sep).join("/")
const rel = (p: string): string => posix.relative(ROOT, posixOf(p))

const config = existsSync(join(ROOT, "effect.boundary.json"))
  ? (JSON.parse(readFileSync(join(ROOT, "effect.boundary.json"), "utf8")) as {
      allowEscapeTo?: Array<{ from: string; to: string[] }>
      allowDeepWorkspaceImports?: string[]
      allowCrossAppImports?: string[]
      /** legacy system/connector apps that may still use fs/network/env directly (TODO: refactor into abstractions) */
      ioExemptApps?: string[]
      /** legacy app files that may still use node:/bun: builtins (TODO: move into abstraction packages) */
      allowNodeBuiltinsFrom?: string[]
      /** legacy app files that may still touch fs/network directly (TODO: refactor to abstractions) */
      allowSystemIoFrom?: string[]
    })
  : {}

const ioExempt = (pkg: Pkg): boolean => (config.ioExemptApps ?? []).includes(pkg.name)

const allowedEscape = (pkg: Pkg, target: string): boolean =>
  (config.allowEscapeTo ?? []).some((a) => matches(a.from, pkg.dir) && a.to.some((t) => matches(t, target)))

const allowedFile = (list: readonly string[] | undefined, fileRel: string): boolean =>
  (list ?? []).some((p) => matches(p, fileRel))

interface Finding {
  severity: "error" | "warn"
  rule: string
  file: string
  specifier: string
  message: string
}

const findings: Finding[] = []

for (const pkg of PKGS) {
  for (const file of files(pkg.dir + "/src")) {
    const src = readFileSync(file, "utf8")
    const fileRel = rel(file)
    const dirRel = posix.dirname(fileRel)
    for (const spec of importSpecifiers(src)) {
      if (spec.startsWith(".")) {
        const resolved = posix.normalize(posix.join(dirRel, spec))
        if (resolved !== pkg.dir && !resolved.startsWith(pkg.dir + "/")) {
          if (!allowedEscape(pkg, resolved)) {
            findings.push({
              severity: "error",
              rule: "R1-escape",
              file: fileRel,
              specifier: spec,
              message: `relative import escapes ${pkg.dir}: -> ${resolved}`,
            })
          }
        }
        continue
      }
      if (isBuiltinSpecifier(spec)) {
        // R4 apps must not use bun/node builtins — go through repo abstractions
        if (pkg.kind === "app" && !ioExempt(pkg) && !allowedFile(config.allowNodeBuiltinsFrom, fileRel)) {
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
      const target = byName.get(workspace)
      if (target === undefined) continue // third-party npm — out of scope

      // R2 deep import (apps must import package roots; packages: warn)
      if (rest !== "" && !config.allowDeepWorkspaceImports?.includes(spec)) {
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
        const allowed = (config.allowCrossAppImports ?? []).some((p) => matches(p, fileRel))
        if (!allowed) {
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
  }
}

// R5 apps must not call bun/node system APIs directly (fs/network/process/env)
for (const pkg of PKGS) {
  if (pkg.kind !== "app" || ioExempt(pkg)) continue
  for (const file of files(pkg.dir + "/src")) {
    const fileRel = rel(file)
    if (allowedFile(config.allowSystemIoFrom, fileRel)) continue
    const hit = scanSystemIo(readFileSync(file, "utf8"))
    if (hit !== undefined) {
      findings.push({
        severity: "error",
        rule: "R5-system-io",
        file: fileRel,
        specifier: hit.match,
        message: `app uses ${hit.label} directly; go through a repo abstraction package instead`,
      })
    }
  }
}

const errors = findings.filter((f) => f.severity === "error")
const warns = findings.filter((f) => f.severity === "warn")

for (const f of findings) {
  const tag = f.severity === "error" ? "ERROR" : "warn "
  console.error(`${tag} [${f.rule}] ${f.file}: ${f.specifier} — ${f.message}`)
}

console.error(`\nboundary: ${PKGS.length} packages scanned · ${errors.length} errors · ${warns.length} warnings`)
if (errors.length > 0 || (STRICT && warns.length > 0)) process.exit(1)
