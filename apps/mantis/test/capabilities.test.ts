/** The capability manifest is the SINGLE source of truth for the tool surface:
 * supply registry, session ops, and (later) UI/MCP surfaces all derive from it. */
import { describe, expect, test } from "bun:test"
import { MANTIS_CAPABILITIES } from "../src/capabilities.ts"
import { supplyFromCapabilities, ToolSupply } from "../src/supply.ts"
import { mantisSupply } from "../src/agent.ts"
import { makeMantisOps, NotesStore } from "../src/tools.ts"

const names = (capabilities: ReadonlyArray<{ name: string }>) => capabilities.map((c) => c.name)

describe("capability manifest integrity", () => {
  test("names are unique and every entry is well-formed", () => {
    expect(new Set(names(MANTIS_CAPABILITIES)).size).toBe(MANTIS_CAPABILITIES.length)
    for (const capability of MANTIS_CAPABILITIES) {
      expect(capability.name.length).toBeGreaterThan(0)
      expect(["core", "extended"]).toContain(capability.tier)
      expect(capability.description.length).toBeGreaterThan(10)
    }
  })
  test("derived supply matches the manifest exactly", () => {
    const derived = supplyFromCapabilities(MANTIS_CAPABILITIES)
    expect(Object.keys(derived).sort()).toEqual(names(MANTIS_CAPABILITIES).sort())
    for (const capability of MANTIS_CAPABILITIES) {
      const spec = derived[capability.name]
      expect(spec?.tier).toBe(capability.tier)
      expect(spec?.description).toBe(capability.description) // single source: no copy drift
    }
  })
  test("the session supply is derived from the manifest (no hand-written copy)", () => {
    expect(Object.keys(mantisSupply).sort()).toEqual(names(MANTIS_CAPABILITIES).sort())
  })
  test("supply visibility follows tiers: core always visible, extended needs enable", () => {
    const supply = new ToolSupply(mantisSupply)
    const core = MANTIS_CAPABILITIES.filter((c) => c.tier === "core").map((c) => c.name)
    const extended = MANTIS_CAPABILITIES.filter((c) => c.tier === "extended").map((c) => c.name)
    for (const name of core) expect(supply.visible()).toContain(name)
    for (const name of extended) expect(supply.visible()).not.toContain(name)
    const catalog = supply.catalog().map((c) => c.name)
    expect(catalog.sort()).toEqual(extended.sort())
  })
  test("the session op surface is exactly the manifest (order preserved)", () => {
    const ops = makeMantisOps({ supply: new ToolSupply(mantisSupply), notes: new NotesStore() })
    expect(ops.map((op) => op.name)).toEqual(names(MANTIS_CAPABILITIES))
  })
})
