/**
 * P3's acceptance: one artifact, several runtimes (§7, §7.5-2/3).
 *
 * What is proven here, and what is not — stated plainly, because the honest
 * version is narrower than the heading:
 *
 *   proven    the same app is compiled once per declared runtime; the
 *             browser/sandbox builds carry no `node:` dependency; given the same
 *             injected capabilities the artifact behaves identically in an os
 *             host and a browser host; a sandbox reports exactly what it was
 *             handed; and a host that lacks a declared capability is refused
 *             before a line of the entry executes.
 *   not proven   that a *real* browser page can load it. There is no browser
 *             host yet (§7.5-5). "browser" below is a host carrying browser
 *             capabilities — the capability seam is real, the page is not.
 */

import { afterAll, beforeAll, expect, test } from "bun:test"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import { makeNodeStore } from "@effect-agent/effect-planes"
import { compileEffectBundle, entryFor, loadEffectBundle } from "../src/index.ts"
import type { RuntimeCapabilities } from "../src/index.ts"
import {
  ambientCapabilities, capabilitiesOf, capabilityGaps, describeCapabilities,
  makeClock, makeCrypto, requireCapability, sandboxCapabilities,
} from "../src/index.ts"

const APP = resolve(import.meta.dir, "fixtures/app-portable")
const OUT = resolve(import.meta.dir, ".bundle-portable")
let dir = ""   // <OUT>/<bundleId>.effect-bundle

beforeAll(async () => {
  rmSync(OUT, { recursive: true, force: true })
  const manifest = await compileEffectBundle({ appDir: APP, outDir: OUT })
  dir = resolve(OUT, manifest.bundleId + ".effect-bundle")
})
afterAll(() => { rmSync(OUT, { recursive: true, force: true }) })

/** Deterministic clock + crypto, so "identical behavior" is a real claim. */
const deterministic = () => {
  let tick = 0
  let uuid = 0
  return {
    clock: makeClock({ now: () => 1_700_000_000_000 + (tick += 1000), setTimeout: (h) => setTimeout(h, 0) }),
    crypto: {
      randomUUID: () => `id-${++uuid}`,
      digest: async (_algorithm: "SHA-256", data: string) => `len-${data.length}`,
    },
  }
}

/** Load the artifact's compiled entry for `runtime`, as a host would. */
const hostOf = async (runtime: "os" | "browser" | "sandbox", capabilities: RuntimeCapabilities) => {
  const manifest = JSON.parse(readFileSync(resolve(dir, "effect.bundle.json"), "utf8")) as { entries?: Record<string, string> }
  const entry = resolve(dir, manifest.entries?.[runtime] ?? "entry.js")
  const module = (await import(pathToFileURL(entry).href)) as { makePortable: (api: unknown) => Portable }
  return module.makePortable({ namespace: "ops", capabilities })
}

interface Portable {
  stamp(text: string): Promise<{ id: string; at: number; digest: string }>
  history(): readonly unknown[]
  runtime: unknown
}

/** A registry-shaped stub — this fixture touches none of it, by design. */
const registryStub = () =>
  ({ tools: () => [], schemas: () => [], registerInterface: () => () => {} }) as never

test("one app compiles once per declared runtime, with no node dependency off-os", () => {
  // the emitted manifest records a build per declared runtime; `entry` stays primary
  const written = JSON.parse(readFileSync(resolve(dir, "effect.bundle.json"), "utf8")) as {
    entry: string; entries: Record<string, string>; runtimes: readonly string[]
  }
  expect(written.runtimes).toEqual(["os", "browser", "sandbox"])
  expect(written.entries).toEqual({ os: entryFor("os"), browser: entryFor("browser"), sandbox: entryFor("sandbox") })
  expect(written.entry).toBe(entryFor("os"))
  for (const runtime of ["os", "browser", "sandbox"] as const) {
    expect(existsSync(resolve(dir, entryFor(runtime)))).toBe(true)
  }

  // The compiler held the line for the non-os targets: no node builtin survives.
  for (const runtime of ["browser", "sandbox"] as const) {
    const source = readFileSync(resolve(dir, entryFor(runtime)), "utf8")
    expect(source).not.toMatch(/["']node:/)
    expect(source).not.toMatch(/require\(\s*["']node:/)
  }
})

test("the same artifact behaves identically in an os host and a browser host", async () => {
  const osHost = await hostOf("os", ambientCapabilities("os", deterministic()))
  const browserHost = await hostOf("browser", ambientCapabilities("browser", deterministic()))

  const fromOs = await osHost.stamp("hello")
  const fromBrowser = await browserHost.stamp("hello")
  // Identical, because nothing the artifact reached for was ambient.
  expect(fromBrowser).toEqual(fromOs)
  expect(fromOs).toEqual({ id: "id-1", at: 1_700_000_001_000, digest: "len-5" })

  await osHost.stamp("again")
  expect(osHost.history()).toHaveLength(2)
  expect(browserHost.history()).toHaveLength(1)   // separate stores, separate histories
  expect(osHost.runtime).toBe("os")
  expect(browserHost.runtime).toBe("browser")
})

test("a sandbox reports exactly what it was handed — not what it nominally has", () => {
  const full = sandboxCapabilities({ clock: makeClock(), crypto: makeCrypto(), storage: makeNodeStore() })
  expect(capabilitiesOf(full)).toEqual(["clock", "storage", "crypto"])   // no network: none was injected
  expect(describeCapabilities(full)).toBe("sandbox: [clock, storage, crypto]")

  // This process obviously has a clock; the sandbox is defined by not having been
  // handed one, so an empty sandbox claims nothing.
  const bare = sandboxCapabilities()
  expect(capabilitiesOf(bare)).toEqual([])
  expect(describeCapabilities(bare)).toBe("sandbox: [(nothing injected)]")
  expect(() => requireCapability(bare, "clock")).toThrow(/provides no "clock"/)
})

test("a host missing a declared capability refuses the artifact before it runs", async () => {
  // app-portable declares requires: [clock, storage, crypto].
  const required = ["clock", "storage", "crypto"] as const
  expect(capabilityGaps(required, sandboxCapabilities())).toEqual([...required])
  expect(capabilityGaps(required, sandboxCapabilities({ clock: makeClock() }))).toEqual(["storage", "crypto"])

  // The refusal must be the gate's, not the entry's own "no clock was injected":
  // that is the difference between refusing a bundle and failing inside one.
  const thin = makeNodeStore()
  const refused = loadEffectBundle(dir, {
    registry: registryStub(),
    runtime: "sandbox",
    capabilities: sandboxCapabilities({ storage: thin }),
  })
  await expect(refused).rejects.toThrow(/requires \[clock, crypto\] but this host is sandbox: \[storage\]/)
  expect(thin.get("app-portable/registered")).toBeUndefined()   // the entry never ran

  // The same artifact is accepted once the host can meet the declaration.
  const full = makeNodeStore()
  const accepted = await loadEffectBundle(dir, {
    registry: registryStub(),
    runtime: "sandbox",
    capabilities: sandboxCapabilities({ clock: makeClock(), crypto: makeCrypto(), storage: full }),
  })
  expect(full.get("app-portable/registered")).toEqual({ runtime: "sandbox" })
  await accepted()
})

test("an artifact compiled before multi-target still loads through `entry`", async () => {
  const legacy = resolve(OUT, "legacy")
  rmSync(legacy, { recursive: true, force: true })
  const manifest = await compileEffectBundle({ appDir: APP, outDir: legacy })
  const legacyDir = resolve(legacy, manifest.bundleId + ".effect-bundle")

  // Strip the per-runtime map the way a pre-P3 artifact would lack it.
  const path = resolve(legacyDir, "effect.bundle.json")
  const written = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>
  delete written.entries
  writeFileSync(path, JSON.stringify(written, null, 2))

  const dispose = await loadEffectBundle(legacyDir, {
    registry: registryStub(),
    runtime: "sandbox",
    capabilities: sandboxCapabilities({ clock: makeClock(), crypto: makeCrypto(), storage: makeNodeStore() }),
  })
  await dispose()
  expect(written.entry).toBe(entryFor("os"))   // fell back to the primary build
})
