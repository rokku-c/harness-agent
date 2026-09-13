/**
 * The kernel artifact, from the build side (docs/architecture-rework.md: the
 * `P3 → P6` chain). P3 could build an *app* bundle and P5-2 could *load* a kernel
 * from a directory, but nothing could *produce* one — staging a kernel meant
 * hand-writing a module exporting `createKernel`, so "push a new kernel" was a
 * thing only tests did.
 *
 * Three claims, in rising order of strength: the shipped kernel's manifest and
 * its code declaration describe the same kernel; the shipped kernel really builds
 * into the directory a loader reads; and an artifact this compiler produced
 * really serves as a kernel revision behind a live flip.
 */

import { expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { BOOTSTRAP_ABI, KERNEL_ABI, readKernelManifest, KERNEL_MANIFEST, compileKernelRevision } from "@effect-agent/effect-bundle"
import { KERNEL } from "../src/boot/kernel.ts"
import { clearFixtureLog, fixtureKernelSource, fixtureLog } from "./kernel-fixture.ts"
import { boot, req, revisionFor, withWorkspace } from "./swap-fixture.ts"

const KERNEL_SOURCE_DIR = new URL("../src/kernel", import.meta.url).pathname
const readManifest = (dir: string) => readKernelManifest(dir, { readFileSync: (path) => readFileSync(path, "utf8") })

test("the shipped kernel's manifest and its declaration describe the same kernel", async () => {
  const manifest = readManifest(KERNEL_SOURCE_DIR)

  // Two statements of one identity. If they drift, a kernel pushed from this
  // checkout claims to be something other than the kernel running it.
  expect(KERNEL.kernelId).toBe(manifest.bundleId)
  expect(manifest.abi).toBe(KERNEL.abi)
  expect(manifest.bootstrapAbi).toBe(KERNEL.bootstrapAbi)
  expect(manifest.runtimes).toEqual(KERNEL.runtimes)
})

test("the shipped kernel builds into the artifact directory a loader reads", async () => {
  const out = mkdtempSync(join(tmpdir(), "effect-kernel-out-"))
  try {
    const manifest = await compileKernelRevision({ kernelDir: KERNEL_SOURCE_DIR, outDir: out })
    const artifact = join(out, manifest.bundleId + ".effect-bundle")

    // The loader joins `revision.dir` with `KERNEL_ENTRY` and imports it; the
    // artifact's own manifest has to name that same compiled file.
    expect(readManifest(artifact).entry).toBe("kernel.js")
  } finally { rmSync(out, { recursive: true, force: true }) }
})

test("an artifact this compiler produced serves as a kernel revision", async () => {
  clearFixtureLog()
  const source = mkdtempSync(join(tmpdir(), "effect-kernel-src-"))
  const out = mkdtempSync(join(tmpdir(), "effect-kernel-out-"))
  try {
    writeFileSync(join(source, "entry.ts"), fixtureKernelSource("k2"))
    writeFileSync(join(source, KERNEL_MANIFEST), JSON.stringify({
      bundleId: "io.effect-agent.kernel@2.0.0", abi: KERNEL_ABI, bootstrapAbi: BOOTSTRAP_ABI, entry: "entry.ts",
    }))
    const compiled = join(out, (await compileKernelRevision({ kernelDir: source, outDir: out })).bundleId + ".effect-bundle")

    await withWorkspace(async (w) => {
      const app = await boot({ configFile: w.configFile, roots: [] })
      try {
        // The shipped kernel answers first, from inside this process.
        expect((await (await app.host.handle(req("/-/config"))).json()).marker).toBeUndefined()

        const staged = await app.stageKernel(revisionFor("io.effect-agent.kernel@2.0.0", 2, compiled, KERNEL_ABI))

        expect(staged.ok).toBe(true)
        expect(app.kernelRevision()?.revision).toBe(2)
        // A request answered with the fixture's own marker: this is the compiled
        // bytes serving, not the built-in kernel wearing a revision number.
        expect(await (await app.host.handle(req("/-/config"))).json()).toMatchObject({ marker: "k2" })
        expect(fixtureLog()).toEqual(["load:k2"])
      } finally { await app.stop() }
    })
  } finally {
    rmSync(source, { recursive: true, force: true })
    rmSync(out, { recursive: true, force: true })
  }
})
