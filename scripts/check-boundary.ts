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

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs"
import { join, dirname, relative, resolve, sep, posix } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const STRICT = process.argv.includes("--strict")

interface Pkg {
  readonly dir: string // repo-relative, posix, e.g. "packages/effect-host"
  readonly name: string
  readonly kind: "app" | "package"
  readonly deps: ReadonlySet<string>
}

const collect = (base: string, kind: Pkg["kind"]): Pkg[] => {
  const dirs = join(ROOT, base)
  if (!existsSync(dirs)) return []
  const out: Pkg[] = []
  for (const entry of readdirSync(dirs)) {
    const pkgJson = join(dirs, entry, "package.json")
    if (!existsSync(pkgJson)) continue
    const raw = JSON.parse(readFileSync(pkgJson, "utf8")) as {
      name?: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const name = raw.name
    if (name === undefined) continue
    out.push({
      dir: base + "/" + entry,
      name,
      kind,
      deps: new Set([...Object.keys(raw.dependencies ?? {}), ...Object.keys(raw.devDependencies ?? {})]),
    })
  }
  return out
}

const PKGS: Pkg[] = [...collect("apps", "app"), ...collect("packages", "package")]
const byName = new Map(PKGS.map((p) => [p.name, p]))

const files = (srcDir: string): string[] => {
  const root = join(ROOT, srcDir)
  if (!existsSync(root)) return []
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec|d)\.ts$/.test(entry)) out.push(full)
    }
  }
  walk(root)
  return out
}

const posixOf = (p: string): string => p.split(sep).join("/")
const rel = (p: string): string => posix.relative(ROOT, posixOf(p))

const matches = (pattern: string, value: string): boolean => {
  const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const segment = (part: string): string =>
    part.split("*").map(escape).join("[^/]*")
  const rx = new RegExp("^" + pattern.split("**").map(segment).join(".*") + "$")
  return rx.test(value)
}

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

const importSpecifiers = (source: string): string[] => {
  const out: string[] = []
  const fromRe = /(?:^|\s)(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g
  const dynRe = /import\s*\(\s*["']([^"']+)["']/g
  for (const re of [fromRe, dynRe]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(source)) !== null) out.push(m[1])
  }
  return out
}

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
      if (spec.startsWith("node:") || spec.startsWith("bun:")) {
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
const SYSTEM_IO: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /Bun\.(serve|spawn|spawnSync|file|write|read|writeSync)\s*\(/g, label: "Bun.serve/spawn/file" },
  { re: /(?:^|[^\w.$])fetch\s*\(/g, label: "network fetch" },
  { re: /(?:^|[^\w.$])(?:WebSocket|connect)\s*\(/g, label: "socket/connect" },
  { re: /process\.(env|cwd|platform|arch|argv|exit)\b/g, label: "process/env" },
]
for (const pkg of PKGS) {
  if (pkg.kind !== "app" || ioExempt(pkg)) continue
  for (const file of files(pkg.dir + "/src")) {
    const src = readFileSync(file, "utf8")
    const fileRel = rel(file)
    if (allowedFile(config.allowSystemIoFrom, fileRel)) continue
    const codeOnly = src
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n")
    for (const { re, label } of SYSTEM_IO) {
      re.lastIndex = 0
      const m = re.exec(codeOnly)
      if (m !== null) {
        findings.push({
          severity: "error",
          rule: "R5-system-io",
          file: fileRel,
          specifier: m[0].trim(),
          message: `app uses ${label} directly; go through a repo abstraction package instead`,
        })
        break
      }
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
