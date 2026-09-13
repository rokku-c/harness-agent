/**
 * P6: how an artifact crosses the process boundary, and what is refused on the
 * way in.
 *
 * Both ends compute the digest, so the property that matters is not "it decodes"
 * but that *nothing* decodes that does not add up. A node that installed the
 * bytes anyway would be running a build nobody published, and it would report
 * success while doing it.
 */

import { expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AgentdError, fromWire, listingDigest, makeArtifactStore, toWire, type WireArtifact } from "../src/index.ts"

const withDir = <T>(build: (dir: string) => void, run: (dir: string) => T): T => {
  const root = mkdtempSync(join(tmpdir(), "wire-"))
  try { build(root); return run(root) } finally { rmSync(root, { recursive: true, force: true }) }
}
const published = (dir: string) => {
  const store = makeArtifactStore()
  store.publish("board@1.0.0", dir)
  return toWire(store, "board@1.0.0")
}
const refusal = (run: () => unknown): string => {
  try { run() } catch (error) { if (error instanceof AgentdError) return `${error.status} ${error.message}`; throw error }
  throw new Error("expected a refusal")
}
/** The same artifact with one field replaced — how a tampered response arrives. */
const tampered = (wire: WireArtifact, over: Partial<WireArtifact>): WireArtifact => ({ ...wire, ...over })

test("what one end sends is what the other end gets, bytes included", () => {
  withDir((dir) => { writeFileSync(join(dir, "kernel.js"), "export const k = 1"); writeFileSync(join(dir, "app.js"), "export const a = 2") }, (dir) => {
    const wire = published(dir)
    const decoded = fromWire(wire)
    expect(decoded.id).toBe("board@1.0.0")
    expect(decoded.digest).toBe(wire.digest)
    expect(decoded.files.map((file) => [file.path, new TextDecoder().decode(file.bytes)]))
      .toEqual([["app.js", "export const a = 2"], ["kernel.js", "export const k = 1"]])
  })
})

test("a file whose bytes do not match its digest is refused by name", () => {
  withDir((dir) => writeFileSync(join(dir, "kernel.js"), "export const k = 1"), (dir) => {
    const wire = published(dir)
    const swapped = tampered(wire, {
      files: [{ ...wire.files[0]!, content: Buffer.from("export const k = 9").toString("base64") }],
    })
    expect(refusal(() => fromWire(swapped)))
      .toStartWith("400 artifact board@1.0.0 file kernel.js does not match its digest")
  })
})

test("a listing whose files do not add up to its digest is refused", () => {
  withDir((dir) => writeFileSync(join(dir, "kernel.js"), "export const k = 1"), (dir) => {
    const wire = published(dir)
    // The file is intact and its own digest checks out, so only the digest over
    // the whole listing can catch this one — a file dropped in transit, or added.
    expect(refusal(() => fromWire(tampered(wire, { digest: "0".repeat(64) }))))
      .toStartWith("400 artifact board@1.0.0 does not match its listing digest")
  })
})

test("a response that is not an artifact at all is refused, not decoded", () => {
  expect(refusal(() => fromWire({ ok: true }))).toBe("400 malformed artifact response")
  expect(refusal(() => fromWire(null))).toBe("400 malformed artifact response")
})

test("the digest over a listing does not depend on the order the files arrived in", () => {
  const a = { path: "a.js", sha256: "1" }, b = { path: "b.js", sha256: "2" }
  expect(listingDigest([a, b])).toBe(listingDigest([b, a]))
  expect(listingDigest([a, b])).not.toBe(listingDigest([a, { path: "b.js", sha256: "3" }]))
})

test("a version with no recorded bytes has nothing to send, and says which version", () => {
  withDir(() => {}, (dir) => {
    const store = makeArtifactStore()
    store.publish("board@1.0.0", dir)
    expect(refusal(() => toWire(store, "kernel@2.0.0")))
      .toBe("404 no artifact bytes for kernel@2.0.0; nothing was published from a directory")
  })
})
