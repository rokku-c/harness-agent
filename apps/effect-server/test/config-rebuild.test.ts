/**
 * The refusal an operator meets at `bun run up`, and the way out of it.
 *
 * The mechanism is `packages/effect-config`; what only shows up here is the
 * composition — that the message names the store and the command, that the
 * command run for real drops the app that was named and nothing else, and that
 * the next boot then re-seeds that app from its current schema and its
 * effect.yaml layer. The store seeded below is the one this repository had.
 */
import { afterEach, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeConfigRegistry, makeSqliteConfigStore, type StoredConfig } from "@effect-agent/effect-config"
import { effectConfig as boardConfig } from "../../board/src/effect-config.ts"
import { effectConfig as mantisConfig } from "../../mantis/src/effect-config.ts"
import { makeConfigRuntime } from "../src/config-runtime/runtime.ts"

/** mantis as the store still held it: the shape from before the schema change. */
const legacyMantis = {
  webPort: 3737, host: "127.0.0.1", configFile: ".effect-agent/mantis/config.toml",
  workspaceDir: ".effect-agent/mantis", approvals: "ask",
}
const mantisRow: StoredConfig = {
  value: legacyMantis,
  sources: Object.fromEntries(Object.keys(legacyMantis).map((key) => [key, "default" as const])),
  revision: 1,
  initialized: true,
}
const boardRow: StoredConfig = { value: { dataFile: ".effect-agent/board.sqlite" }, sources: { dataFile: "override" }, revision: 2, initialized: true }

const disposers: Array<() => void> = []
afterEach(() => { for (const dispose of disposers.splice(0).reverse()) dispose() })

const seeded = () => {
  const dir = mkdtempSync(join(tmpdir(), "effect-config-store-"))
  const file = join(dir, "config-v2.sqlite")
  const store = makeSqliteConfigStore({ file })
  store.write("mantis", mantisRow)
  store.write("board", boardRow)
  const registry = makeConfigRegistry({ store })
  registry.register(mantisConfig)
  registry.register(boardConfig)
  disposers.push(() => { registry.close(); store.close(); rmSync(dir, { recursive: true, force: true }) })
  return { file, store, registry, runtime: makeConfigRuntime(registry, async () => {}, { storeFile: file }) }
}

test("the boot refusal names the app, the store file, and the command that fixes it", () => {
  const { file, runtime } = seeded()
  // The premise, checked rather than assumed: this really is a schema mismatch,
  // so the test fails loudly if the recorded shape ever becomes current again.
  expect(mantisConfig.schema.safeParse(legacyMantis).success).toBe(false)

  let thrown = ""
  try { runtime.initialize("mantis", { yaml: { workspaceDir: "/srv/mantis" } }) }
  catch (error) { thrown = error instanceof Error ? error.message : String(error) }

  expect(thrown).toContain("Invalid config for mantis")
  expect(thrown).toContain(`store: ${file}`)
  expect(thrown).toContain("bun run config:rebuild mantis")
})

test("the rebuild command drops the named record, spares the others, and lets the next boot seed it", () => {
  const { file, store, registry, runtime } = seeded()

  const ran = Bun.spawnSync({
    cmd: ["bun", join(import.meta.dir, "../../../scripts/rebuild-config.ts"), "mantis", "deckconsole"],
    env: { ...process.env, EFFECT_CONFIG_FILE: file },
    stdout: "pipe", stderr: "pipe",
  })

  expect(ran.exitCode).toBe(0)
  expect(ran.stdout.toString()).toContain("mantis: record dropped")
  // An app that had nothing is reported as such rather than quietly "rebuilt".
  expect(ran.stdout.toString()).toContain("deckconsole: no record")
  // The record that was already valid is not collateral damage.
  expect(store.read("board")).toEqual(boardRow)

  runtime.initialize("mantis", { yaml: { workspaceDir: "/srv/mantis" } })
  expect(runtime.active("mantis")).toMatchObject({ workspaceDir: "/srv/mantis" })
  expect(registry.read("mantis")).toMatchObject({ ok: true, revision: 1, sources: { workspaceDir: "yaml" } })
  expect(store.read("board")).toEqual(boardRow)
})
