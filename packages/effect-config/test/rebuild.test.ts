/**
 * Rebuilding one app's stored configuration: what a refusal means, what dropping
 * a record does to the rest of the store, and what the next initialize does with
 * the gap it left. The stored value is the authority, so the question these
 * answer is whether an operator can survive a schema change without paying for
 * it with the other apps' config.
 */
import { afterEach, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  makeConfigRegistry, makeSqliteConfigStore, z, type ConfigDeclaration, type StoredConfig,
} from "../src/index.ts"

/** The app after the change — and a second app that must not be collateral damage. */
const mantis: ConfigDeclaration = { appId: "mantis", schema: z.object({ workspaceDir: z.string().default(".effect-agent/mantis") }) }
const board: ConfigDeclaration = { appId: "board", schema: z.object({ dataFile: z.string().min(1).default(".effect-agent/board.sqlite") }) }
/** mantis before the change: the shape this repository's store actually holds. */
const legacy = { webPort: 3737, host: "127.0.0.1", configFile: ".effect-agent/mantis/config.toml", workspaceDir: ".effect-agent/mantis", approvals: "ask" }

const record = (value: unknown, revision: number): StoredConfig => ({
  value,
  sources: Object.fromEntries(Object.keys(value as Record<string, unknown>).map((key) => [key, "override" as const])),
  revision,
  initialized: true,
})

const disposers: Array<() => void> = []
afterEach(() => { for (const dispose of disposers.splice(0).reverse()) dispose() })

const seeded = () => {
  const dir = mkdtempSync(join(tmpdir(), "effect-config-rebuild-"))
  const store = makeSqliteConfigStore({ file: join(dir, "config.sqlite") })
  const registry = makeConfigRegistry({ store })
  disposers.push(() => { registry.close(); store.close(); rmSync(dir, { recursive: true, force: true }) })
  registry.register(mantis)
  registry.register(board)
  const stale = record(legacy, 3)
  const other = record({ dataFile: ".effect-agent/board.sqlite" }, 4)
  store.write("mantis", stale)
  store.write("board", other)
  return { store, registry, stale, other }
}

test("a record from the previous schema is refused as a rebuild and left where it is", () => {
  const { store, registry, stale } = seeded()

  const out = registry.initialize("mantis")

  expect(out.ok).toBe(false)
  // Typed: whatever offers the operator a way out must be able to tell this
  // refusal from every other one without matching on the wording.
  expect(out.reason).toBe("rebuild-required")
  expect(out.error).toContain("does not match the current schema")
  // Refusing is not repairing: the value the operator configured is still there.
  expect(store.read("mantis")).toEqual(stale)
})

test("a refusal that is not a rebuild carries no rebuild instruction", () => {
  const { store, registry } = seeded()
  store.remove("mantis")
  registry.initialize("mantis")

  const out = registry.save("mantis", { workspaceDir: "ok", approvals: "ask" })

  expect(out.ok).toBe(false)
  expect(out.reason).toBeUndefined()
  expect(out.error).toContain("unrecognized_keys")
})

test("dropping one app's record leaves every other app's config exactly as it was", () => {
  const { store, other } = seeded()

  store.remove("mantis")

  expect(store.read("mantis")).toBeUndefined()
  expect(store.read("board")).toEqual(other)
})

test("the next initialize re-seeds the dropped record from the current schema and its layers", () => {
  const { store, registry, other } = seeded()
  store.remove("mantis")

  const out = registry.initialize("mantis", { yaml: { workspaceDir: "/srv/mantis" } })

  expect(out).toMatchObject({ ok: true, value: { workspaceDir: "/srv/mantis" }, sources: { workspaceDir: "yaml" }, revision: 1 })
  // The yaml layer is back — which is exactly what a drop-and-seed-from-defaults
  // shortcut would have silently dropped, leaving a config that validates and is
  // not the operator's.
  expect(registry.read("mantis")).toMatchObject({ ok: true, sources: { workspaceDir: "yaml" } })
  expect(store.read("board")).toEqual(other)
})

test("dropping a record that is not there is a no-op, not an error", () => {
  const { store } = seeded()

  expect(() => store.remove("ui-host")).not.toThrow()
  expect(store.read("board")).toBeDefined()
})
