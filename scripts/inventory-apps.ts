/**
 * inventory-apps — the P1 inventory of docs/architecture-rework.md §10.
 *
 * Answers, per app, the preconditions the architecture rework stands on:
 *
 *   1. ambient dependencies (§7.2) — does it reach fs/network/process directly?
 *   2. required runtime (§7.1)     — what is the lightest runtime it could run in?
 *   3. bundle declaration (§5)     — does it ship an artifact header, with which abi/runtimes?
 *
 * Deliberately IGNORES effect.boundary.json's grandfathering lists: a
 * grandfathered exemption is an allowance to write the code, not evidence the
 * app can leave the OS host. The boundary checker enforces policy; this reports
 * reality. The facts come from lib/inventory-app.ts, the report body from
 * lib/inventory-markdown.ts; this file owns the CLI modes.
 *
 *   bun scripts/inventory-apps.ts            # markdown -> docs/app-portability-inventory.md
 *   bun scripts/inventory-apps.ts --json     # machine-readable -> stdout
 *   bun scripts/inventory-apps.ts --check    # exit 1 if a bundle omits runtimes
 */

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
