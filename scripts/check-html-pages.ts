import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const APPS = join(ROOT, "apps")
const REQUIRED = ["index.html", "app.css", "client.js"] as const
const INLINE_PAGE = /<!doctype\s+html|<style[\s>]|<script[\s>]/i
const errors: string[] = []

const rel = (path: string): string => relative(ROOT, path).split("\\").join("/")
const dirs = (path: string): string[] => readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory())

for (const app of dirs(APPS)) {
  const src = join(APPS, app, "src")
  if (!existsSync(src)) continue
  const composer = join(src, "effect-ui-html.ts")
  if (existsSync(composer)) {
    const source = readFileSync(composer, "utf8")
    if (INLINE_PAGE.test(source)) errors.push(`${rel(composer)}: full HTML pages must live in a *-page asset directory`)
    if (source.includes("-page/index.html") && !source.includes("defineHtmlPage")) {
      errors.push(`${rel(composer)}: page assets must be composed with defineHtmlPage(...)`)
    }
  }
  for (const entry of readdirSync(src)) {
    if (!entry.endsWith("-page") || !statSync(join(src, entry)).isDirectory()) continue
    const page = join(src, entry)
    for (const file of REQUIRED) {
      if (!existsSync(join(page, file))) errors.push(`${rel(page)}: missing ${file}`)
    }
    const htmlFile = join(page, "index.html")
    if (!existsSync(htmlFile)) continue
    const html = readFileSync(htmlFile, "utf8")
    if (!html.includes("/*__PAGE_CSS__*/")) errors.push(`${rel(htmlFile)}: missing /*__PAGE_CSS__*/`)
    if (!html.includes("/*__PAGE_CLIENT__*/")) errors.push(`${rel(htmlFile)}: missing /*__PAGE_CLIENT__*/`)
  }
}

if (errors.length > 0) {
  console.error("html-page structure check failed:")
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}
console.log("html-page structure check: clean")
