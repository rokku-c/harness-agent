import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { stripOf } from "./comment-text.ts"

const SKIP = new Set(["node_modules", ".git", "dist", "public", "board-mcp", ".agents", ".claude", ".effect-bundles"])
const SOURCE = /\.(ts|tsx|js|cjs|lean|css|ya?ml|toml|sh)$/

const walk = async (dir: string): Promise<readonly string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const found: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) found.push(...await walk(path))
      continue
    }
    if (SOURCE.test(entry.name) || entry.name === ".gitignore") found.push(path)
  }
  return found
}

const fix = process.argv.includes("--fix")
const root = process.cwd()
const files = await walk(root)
const dirty: string[] = []
let removed = 0

for (const path of files) {
  const text = await readFile(path, "utf8")
  const stripped = stripOf(path, text)
  if (stripped === text) continue
  dirty.push(path.slice(root.length + 1))
  removed += text.split("\n").length - stripped.split("\n").length
  if (fix) await writeFile(path, stripped)
}

if (fix) {
  console.log(`comment-purge: rewrote ${dirty.length} of ${files.length} files, ${removed} comment lines removed`)
} else if (dirty.length === 0) {
  console.log(`comment-check: clean (${files.length} files)`)
} else {
  for (const path of dirty) console.log(`  ${path}`)
  console.log(`comment-check: ${dirty.length} of ${files.length} files carry comments (about ${removed} lines)`)
  process.exit(1)
}
