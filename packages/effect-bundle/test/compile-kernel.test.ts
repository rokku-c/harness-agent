/**
 * compileKernelRevision — the build step that turns a kernel source dir into the
 * artifact directory a loader imports (docs/architecture-rework.md, P3 → P6 chain).
 *
 * What is pinned here is the *contract between the compiler and the loader*: the
 * artifact directory it writes is the one `loadKernel` reads (`kernel.js`,
 * exporting `createKernel`), and a manifest it cannot adjudicate stops the build
 * rather than producing an artifact that lies about itself.
 */

import { expect, test } from "bun:test"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { compileKernelRevision, KERNEL_ENTRY, KERNEL_MANIFEST, readKernelManifest } from "../src/index.ts"

const SOURCE = `
export const createKernel = () => ({
  id: "fixture", planes: new Map(),
  start: async () => {}, stop: async () => {}, health: async () => {}, dispose: async () => {},
})
`

/** A kernel source dir. `over` replaces manifest fields, `source` the entry. */
const kernelDir = (over: Record<string, unknown> = {}, source = SOURCE): string => {
  const dir = mkdtempSync(join(tmpdir(), "effect-kernel-src-"))
  writeFileSync(join(dir, "entry.ts"), source)
  writeFileSync(join(dir, KERNEL_MANIFEST), JSON.stringify({
    bundleId: "io.effect-agent.fixture@1.0.0", abi: "effect-1", bootstrapAbi: "bootstrap-1",
    runtimes: ["os"], entry: "entry.ts", ...over,
  }))
  return dir
}

/** Run `body` against a scratch output dir, and clean both it and the source up. */
const withDirs = async (body: (source: string, out: string) => Promise<void>): Promise<void> => {
  const source = kernelDir(), out = mkdtempSync(join(tmpdir(), "effect-kernel-out-"))
  try { await body(source, out) } finally {
    rmSync(source, { recursive: true, force: true })
    rmSync(out, { recursive: true, force: true })
  }
}

test("a compiled kernel is the directory a loader imports, entry included", async () => {
  await withDirs(async (source, out) => {
    const manifest = await compileKernelRevision({ kernelDir: source, outDir: out })
    const artifact = join(out, manifest.bundleId + ".effect-bundle")
    const entry = join(artifact, KERNEL_ENTRY)

    // The directory the loader is pointed at holds the module it imports...
    expect(existsSync(entry)).toBe(true)
    expect(typeof (await import(pathToFileURL(entry).href) as { createKernel?: unknown }).createKernel).toBe("function")
    // ...and its manifest describes the *build*, not the source: entry is now the
    // compiled name, and everything else about the kernel is unchanged.
    const built = readKernelManifest(artifact, { readFileSync: (path) => readFileSync(path, "utf8") })
    expect(built).toEqual({ ...manifest, entry: KERNEL_ENTRY })
  })
})

test("a manifest naming no bootstrap line is refused, and no artifact is written", async () => {
  await withDirs(async (source, out) => {
    // A kernel with no host line is not a kernel anything can adjudicate — and
    // finding that out on a target machine mid-swap is far too late.
    writeFileSync(join(source, KERNEL_MANIFEST), JSON.stringify({
      bundleId: "io.effect-agent.fixture@1.0.0", abi: "effect-1", entry: "entry.ts",
    }))

    let thrown = ""
    try { await compileKernelRevision({ kernelDir: source, outDir: out }) } catch (error) {
      thrown = error instanceof Error ? error.message : String(error)
    }
    expect(thrown).toContain("missing bootstrapAbi")
    expect(readdirSync(out)).toEqual([])
  })
})

test("an entry that will not build fails the compile instead of yielding an empty artifact", async () => {
  await withDirs(async (source, out) => {
    writeFileSync(join(source, "entry.ts"), "export const createKernel = ( => {")

    let thrown = ""
    try { await compileKernelRevision({ kernelDir: source, outDir: out }) } catch (error) {
      thrown = error instanceof Error ? error.message : String(error)
    }
    expect(thrown).toContain("kernel build failed")
  })
})
