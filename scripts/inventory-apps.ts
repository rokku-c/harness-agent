import { writeFileSync } from "node:fs"
import { join, posix, resolve } from "node:path"
import { bundleRuntimes, EFFECT_RUNTIME_KINDS } from "../packages/effect-bundle/src/compat.ts"
import { collectPackages } from "./lib/package-graph.ts"
import { inspectApp } from "./lib/inventory-app.ts"
import { renderInventory } from "./lib/inventory-markdown.ts"

const ROOT = resolve(import.meta.dir, "..")
const OUT = join(ROOT, "docs/app-portability-inventory.md")

const inventory = collectPackages(ROOT, "apps", "app").map((app) => inspectApp(ROOT, app))

if (process.argv.includes("--check")) {
  const missing = inventory.filter((a) => a.abi !== undefined && (a.declaredRuntimes ?? []).length === 0)
  for (const app of missing) console.error(`missing runtimes: ${app.dir}/effect.bundle.json (abi ${app.abi ?? "?"})`)
  const bad = inventory.flatMap((a) =>
    (a.declaredRuntimes ?? [])
      .filter((r) => !EFFECT_RUNTIME_KINDS.includes(r))
      .map((r) => `${a.dir}: unknown runtime "${r}"`),
  )
  for (const b of bad) console.error(b)
  console.error(`inventory: ${inventory.length} apps · ${missing.length} without runtimes · ${bad.length} invalid`)
  process.exit(missing.length > 0 || bad.length > 0 ? 1 : 0)
} else if (process.argv.includes("--json")) {
  console.log(JSON.stringify(inventory, null, 2))
} else {
  writeFileSync(OUT, renderInventory(inventory) + "\n")
  console.error(`inventory: wrote ${posix.relative(ROOT, OUT)} (${inventory.length} apps)`)
  for (const app of inventory) {
    const runtimes = bundleRuntimes({ runtimes: app.declaredRuntimes }).join(",")
    console.error(`  ${app.dir} · floor=${app.floor} · runtimes=${runtimes}`)
  }
}
