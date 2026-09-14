import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const MAX = 100
const ROOTS = [
  "packages/*/src",
  "apps/*/src",
  "examples",
  "scripts"
]

const walk = (dir: string, out: string[]): void => {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
}

const expand = (root: string, out: string[]): void => {
  const [prefix, pattern] = root.split("/*/")
  if (pattern === undefined) {
    walk(root, out)
    return
  }
  for (const child of readdirSync(prefix)) {
    const full = join(prefix, child, pattern)
    try {
      if (statSync(full).isDirectory()) walk(full, out)
    } catch {
      /* glob arm with no such child */
    }
  }
}

const countLines = (file: string): number => {
  const text = readFileSync(file, "utf-8")
  return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length
}

const main = (argv: ReadonlyArray<string>): number => {
  const skip: string[] = []
  const roots: string[] = []
  let max = MAX
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--max") max = Number(argv[++i])
    else if (argv[i] === "--dirs") {
      while (i + 1 < argv.length && !argv[i + 1]!.startsWith("--")) roots.push(argv[++i]!)
    } else if (argv[i] === "--skip-dirs") {
      while (i + 1 < argv.length && !argv[i + 1]!.startsWith("--")) skip.push(argv[++i]!)
    }
  }
  const effectiveRoots = roots.length > 0 ? roots : ROOTS
  const files: string[] = []
  for (const root of effectiveRoots) {
    if (skip.some((s) => root.includes(s))) continue
    expand(root, files)
  }
  const over = files
    .map((file) => ({ file, lines: countLines(file) }))
    .filter((f) => f.lines > max)
    .sort((a, b) => b.lines - a.lines)
  const cwd = process.cwd()
  if (over.length === 0) {
    console.log(`check-lines: clean (${files.length} files, cap ${max} lines)`)
    return 0
  }
  console.log(`check-lines: ${over.length}/${files.length} files exceed ${max} lines:`)
  for (const o of over) console.log(`  ${String(o.lines).padStart(4)}  ${relative(cwd, o.file)}`)
  console.log("fix: one concern per file, keep each <= " + max + " lines")
  return 1
}

process.exit(main(process.argv.slice(2)))
