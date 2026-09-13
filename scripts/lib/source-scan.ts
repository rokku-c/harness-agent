/**
 * Source-scanning primitives shared by scripts/check-boundary.ts (enforcement)
 * and scripts/inventory-apps.ts (portability inventory).
 *
 * One implementation, two questions. The boundary checker asks "is this app
 * allowed to reach the system directly?" and honours the grandfathering lists in
 * effect.boundary.json. The inventory asks "could this app run somewhere other
 * than the OS host?" and deliberately ignores those lists, because a
 * grandfathered exemption still means the app cannot leave the OS.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

export interface Pkg {
  /** repo-relative, posix, e.g. "packages/effect-host" */
  readonly dir: string
  readonly name: string
  readonly kind: "app" | "package"
  readonly deps: ReadonlySet<string>
}

export const collectPackages = (root: string, base: string, kind: Pkg["kind"]): Pkg[] => {
  const dirs = join(root, base)
  if (!existsSync(dirs)) return []
  const out: Pkg[] = []
  for (const entry of readdirSync(dirs).sort()) {
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

/** Non-test .ts/.tsx sources under `<root>/<srcDir>`, excluding node_modules and dotdirs. */
export const sourceFiles = (root: string, srcDir: string): string[] => {
  const start = join(root, srcDir)
  if (!existsSync(start)) return []
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec|d)\.tsx?$/.test(entry)) out.push(full)
    }
  }
  walk(start)
  return out
}

/** Glob-ish matcher matching check-boundary's semantics (`*` within a segment, `**` any depth). */
export const matches = (pattern: string, value: string): boolean => {
  const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const segment = (part: string): string => part.split("*").map(escape).join("[^/]*")
  const rx = new RegExp("^" + pattern.split("**").map(segment).join(".*") + "$")
  return rx.test(value)
}

export const importSpecifiers = (source: string): string[] => {
  const out: string[] = []
  const fromRe = /(?:^|\s)(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g
  const dynRe = /import\s*\(\s*["']([^"']+)["']/g
  for (const re of [fromRe, dynRe]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(source)) !== null) out.push(m[1])
  }
  return out
}

export const isBuiltinSpecifier = (spec: string): boolean => spec.startsWith("node:") || spec.startsWith("bun:")

/** Ambient system access an app is not supposed to reach for directly. */
export const SYSTEM_IO: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /Bun\.(serve|spawn|spawnSync|file|write|read|writeSync)\s*\(/g, label: "Bun.serve/spawn/file" },
  { re: /(?:^|[^\w.$])fetch\s*\(/g, label: "network fetch" },
  { re: /(?:^|[^\w.$])(?:WebSocket|connect)\s*\(/g, label: "socket/connect" },
  { re: /process\.(env|cwd|platform|arch|argv|exit)\b/g, label: "process/env" },
]

/** Line-comment-only stripping — enough to avoid flagging prose in headers. */
export const stripComments = (source: string): string =>
  source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n")

export interface SystemIoHit {
  readonly label: string
  readonly match: string
}

/** First ambient-IO hit in the source, or undefined. */
export const scanSystemIo = (source: string): SystemIoHit | undefined => {
  const code = stripComments(source)
  for (const { re, label } of SYSTEM_IO) {
    re.lastIndex = 0
    const m = re.exec(code)
    if (m !== null) return { label, match: m[0].trim() }
  }
  return undefined
}
