import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const APPS = join(ROOT, "apps")
const errors: string[] = []

const rel = (path: string): string => relative(ROOT, path).split("\\").join("/")
const files = (dir: string, suffix = ""): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? files(path, suffix) : path.endsWith(suffix) ? [path] : []
})
const hasDescriptorPage = (src: string): boolean =>
  readdirSync(src).some((name) => name.endsWith("-page") && statSync(join(src, name)).isDirectory())
const matches = (source: string, pattern: RegExp): string[] => [...source.matchAll(pattern)].map((match) => match[1]!)

for (const app of readdirSync(APPS)) {
  const appDir = join(APPS, app)
  const src = join(appDir, "src")
  if (!existsSync(src)) continue
  const builtIn = existsSync(join(appDir, "effect.yaml"))
  const sources = files(src, ".ts").concat(files(src, ".tsx"))
  for (const file of sources) {
    const source = readFileSync(file, "utf8")
    if (/\buiHtml\b/.test(source)) errors.push(`${rel(file)}: raw uiHtml descriptors are not allowed`)
  }
  const viewFile = join(src, "effect-ui.ts")
  const descriptorPage = hasDescriptorPage(src)
  if (builtIn && !existsSync(viewFile)) {
    errors.push(`${rel(appDir)}: built-in apps must declare src/effect-ui.ts`)
    continue
  }
  if (descriptorPage) errors.push(`${rel(src)}: built-in apps cannot use raw page directories`)
  if (!existsSync(viewFile)) continue
  const viewFiles = readdirSync(src).filter((name) => name.startsWith("effect-ui") && name.endsWith(".ts")).map((name) => join(src, name))
  const view = viewFiles.map((file) => readFileSync(file, "utf8")).join("\n")
  if (view.includes('kind: "embed"')) errors.push(`${rel(viewFile)}: built-in app views cannot embed arbitrary code; use a resource preview`)
  const actions = new Set(matches(view, /name:\s*"([^"]+)"/g))
  for (const action of matches(view, /onPress:\s*"([^"]+)"/g)) {
    if (!actions.has(action)) errors.push(`${rel(viewFile)}: action is not declared: ${action}`)
  }
}

if (errors.length > 0) {
  console.error("ui boundary check failed:")
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}
console.log("ui boundary check: clean")
