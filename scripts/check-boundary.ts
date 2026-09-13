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
 *   R4 no bun/node builtins from apps, R5 no direct fs/network/process calls
 *   W  workspace imports should be declared in the importer's dependencies
 *
 * The rules live in ./lib/boundary-*.ts; this file owns the walk, the report and
 * the exit code. Allowances live in ./effect.boundary.json (composer roots that
 * may load app plugin modules, etc.). Exit code 1 on any R violation; --strict
 * also fails on W.
 *
 *   bun scripts/check-boundary.ts [--strict]
 */

import { readFileSync } from "node:fs"
import { posix, resolve, sep } from "node:path"
import { collectPackages, sourceFiles } from "./lib/package-graph.ts"
import { fileAllowed, ioExempt, loadBoundaryConfig } from "./lib/boundary-config.ts"
import { formatFinding, type Finding } from "./lib/boundary-finding.ts"
import { importFindings } from "./lib/boundary-import-rules.ts"
import { systemIoFindings } from "./lib/boundary-system-io-rules.ts"

const ROOT = resolve(import.meta.dir, "..")
const STRICT = process.argv.includes("--strict")

const PKGS = [...collectPackages(ROOT, "apps", "app"), ...collectPackages(ROOT, "packages", "package")]
const byName = new Map(PKGS.map((p) => [p.name, p]))
const config = loadBoundaryConfig(ROOT)

const files = (srcDir: string): string[] => sourceFiles(ROOT, srcDir)
const posixOf = (p: string): string => p.split(sep).join("/")
const rel = (p: string): string => posix.relative(ROOT, posixOf(p))

const findings: Finding[] = []

// R1-R4 and W, per source file
for (const pkg of PKGS) {
  for (const file of files(pkg.dir + "/src")) {
    const src = readFileSync(file, "utf8")
    findings.push(...importFindings(pkg, src, { config, byName, fileRel: rel(file) }))
  }
}

// R5 apps must not call bun/node system APIs directly (fs/network/process/env)
for (const pkg of PKGS) {
  if (pkg.kind !== "app" || ioExempt(config, pkg)) continue
  for (const file of files(pkg.dir + "/src")) {
    const fileRel = rel(file)
    if (fileAllowed(config.allowSystemIoFrom, fileRel)) continue
    findings.push(...systemIoFindings(fileRel, readFileSync(file, "utf8")))
  }
}

const errors = findings.filter((f) => f.severity === "error")
const warns = findings.filter((f) => f.severity === "warn")

for (const f of findings) console.error(formatFinding(f))

console.error(`\nboundary: ${PKGS.length} packages scanned · ${errors.length} errors · ${warns.length} warnings`)
if (errors.length > 0 || (STRICT && warns.length > 0)) process.exit(1)
