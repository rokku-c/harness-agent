import { afterAll, beforeAll, expect, test } from "bun:test"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { makeEffectRegistry } from "@effect-agent/effect-interface"
import {
  abiLine,
  assessBundleCompat,
  assertBundleCompat,
  bundleRuntimes,
  BundleIncompatibleError,
  compileEffectBundle,
  describeCompat,
  KERNEL_ABI,
  loadEffectBundle,
} from "../src/index.ts"

const APP = resolve(import.meta.dir, "fixtures/app-one")
const OUT = resolve(import.meta.dir, ".compat-out")

beforeAll(() => {
  rmSync(OUT, { recursive: true, force: true })
})

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true })
})

const bundleDir = (bundleId: string): string => resolve(OUT, bundleId + ".effect-bundle")

/** Recompile the fixture and stamp extra manifest fields onto the artifact. */
const artifact = async (patch: Record<string, unknown> = {}): Promise<string> => {
  const manifest = await compileEffectBundle({ appDir: APP, outDir: OUT })
  const dir = bundleDir(manifest.bundleId)
  const path = resolve(dir, "effect.bundle.json")
  const current = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>
  writeFileSync(path, JSON.stringify({ ...current, ...patch }, null, 2))
  return dir
}

test("abiLine recognizes effect-<major> and rejects anything else", () => {
  expect(abiLine("effect-1")).toBe("effect-1")
  expect(abiLine("effect-12")).toBe("effect-12")
  expect(abiLine(" effect-2 ")).toBe("effect-2")
  expect(abiLine("effect-1.1")).toBeUndefined()
  expect(abiLine("v1")).toBeUndefined()
  expect(abiLine("")).toBeUndefined()
})

test("a bundle that declares nothing is os-only", () => {
  expect(bundleRuntimes({})).toEqual(["os"])
  expect(bundleRuntimes({ runtimes: [] })).toEqual(["os"])
  expect(bundleRuntimes({ runtimes: ["browser"] })).toEqual(["browser"])
})

test("same ABI line + host runtime is accepted", () => {
  expect(assessBundleCompat({ abi: KERNEL_ABI })).toEqual({ ok: true })
  expect(assessBundleCompat({ abi: "effect-1", runtimes: ["os"] }, { runtime: "os" })).toEqual({ ok: true })
  expect(assessBundleCompat({ abi: "effect-1", runtimes: ["browser"] }, { runtime: "browser" })).toEqual({ ok: true })
  expect(assessBundleCompat({ abi: "effect-1", runtimes: ["os", "sandbox"] }, { runtime: "sandbox" })).toEqual({
    ok: true,
  })
})

test("a different ABI line is refused with abi-mismatch", () => {
  const verdict = assessBundleCompat({ bundleId: "app@2", abi: "effect-2" })
  expect(verdict.ok).toBe(false)
  if (verdict.ok) return
  expect(verdict.reason.code).toBe("abi-mismatch")
  expect(verdict.reason.required).toBe("effect-2")
  expect(verdict.reason.provided).toBe(KERNEL_ABI)
  expect(verdict.reason.message).toContain("app@2")
  expect(verdict.reason.message).toContain("effect-2")
  expect(verdict.reason.message).toContain("effect-1")
})

test("an unparseable ABI is refused rather than assumed compatible", () => {
  const theirs = assessBundleCompat({ bundleId: "app@x", abi: "v1" })
  expect(theirs.ok).toBe(false)
  if (!theirs.ok) expect(theirs.reason.code).toBe("abi-unparseable")

  const ours = assessBundleCompat({ abi: "effect-1" }, { abi: "banana" })
  expect(ours.ok).toBe(false)
  if (!ours.ok) expect(ours.reason.code).toBe("abi-unparseable")
})

test("a host runtime the bundle does not declare is refused", () => {
  const verdict = assessBundleCompat({ bundleId: "app@1", abi: "effect-1" }, { runtime: "browser" })
  expect(verdict.ok).toBe(false)
  if (verdict.ok) return
  expect(verdict.reason.code).toBe("runtime-unsupported")
  expect(verdict.reason.required).toBe("os")
  expect(verdict.reason.provided).toBe("browser")
})

test("assertBundleCompat throws a typed error carrying the reason", () => {
  expect(() => assertBundleCompat({ abi: "effect-1", runtimes: ["browser"] }, { runtime: "os" })).toThrow(
    BundleIncompatibleError,
  )
  try {
    assertBundleCompat({ bundleId: "app@1", abi: "effect-9" })
    throw new Error("expected assertBundleCompat to throw")
  } catch (error) {
    expect(error).toBeInstanceOf(BundleIncompatibleError)
    const typed = error as BundleIncompatibleError
    expect(typed.name).toBe("BundleIncompatibleError")
    expect(typed.reason.code).toBe("abi-mismatch")
    expect(typed.message).toContain("refused")
  }
})

test("describeCompat reports both acceptance and refusal in one line", () => {
  expect(describeCompat({ bundleId: "app@1", abi: "effect-1" })).toContain("ok:")
  expect(describeCompat({ bundleId: "app@1", abi: "effect-2" })).toContain("refused(abi-mismatch)")
})

test("an artifact the host cannot run never executes its entry", async () => {
  const dir = await artifact({ runtimes: ["browser"] })
  const registry = makeEffectRegistry()

  await expect(loadEffectBundle(dir, { registry, namespace: "ops" })).rejects.toThrow(BundleIncompatibleError)
  // the entry would have registered ops::app-one.echo — proof it never ran
  expect(registry.tools()).toHaveLength(0)
})

test("an artifact on a different ABI line never executes its entry", async () => {
  const dir = await artifact({ abi: "effect-2" })
  const registry = makeEffectRegistry()

  await expect(loadEffectBundle(dir, { registry, namespace: "ops" })).rejects.toThrow(BundleIncompatibleError)
  expect(registry.tools()).toHaveLength(0)
})

test("a bundle that declares nothing still loads on the default os host", async () => {
  const dir = await artifact()
  const registry = makeEffectRegistry()

  const dispose = await loadEffectBundle(dir, { registry, namespace: "ops" })
  expect(registry.tools().map((t) => t.key)).toContain("ops::app-one.echo")

  await dispose()
  expect(registry.tools()).toHaveLength(0)
})

test("a host may load a portable bundle by declaring its runtime", async () => {
  const dir = await artifact({ runtimes: ["os", "browser"] })
  const registry = makeEffectRegistry()

  const dispose = await loadEffectBundle(dir, { registry, namespace: "ops", runtime: "browser" })
  expect(registry.tools().map((t) => t.key)).toContain("ops::app-one.echo")

  await dispose()
})

test("an explicit host abi override is honoured", async () => {
  const dir = await artifact({ abi: "effect-2" })
  const registry = makeEffectRegistry()

  const dispose = await loadEffectBundle(dir, { registry, namespace: "ops", abi: "effect-2" })
  expect(registry.tools().map((t) => t.key)).toContain("ops::app-one.echo")

  await dispose()
})
