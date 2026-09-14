import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

export interface Pkg {
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
