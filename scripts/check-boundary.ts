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

for (const pkg of PKGS) {
  for (const file of files(pkg.dir + "/src")) {
    const src = readFileSync(file, "utf8")
    findings.push(...importFindings(pkg, src, { config, byName, fileRel: rel(file) }))
  }
}

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
