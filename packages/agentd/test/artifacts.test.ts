/**
 * P6: where a published version's bytes are.
 *
 * The store holds a *reference* to the published directory, not a copy, so the
 * properties worth pinning are the ones a reference can get wrong: a listing
 * that misses a file, a digest that depends on readdir order, and a read that
 * follows a path out of the artifact.
 */

import { expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { AgentdError, listingDigest, makeArtifactStore } from "../src/index.ts"

const withDir = <T>(build: (dir: string) => void, run: (dir: string) => T): T => {
  const root = mkdtempSync(join(tmpdir(), "artifact-"))
  try { build(root); return run(root) } finally { rmSync(root, { recursive: true, force: true }) }
}
const files = (root: string, written: Record<string, string>): void => {
  for (const [path, content] of Object.entries(written)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
}
const refusal = (run: () => unknown): string => {
  try { run() } catch (error) { if (error instanceof AgentdError) return `${error.status} ${error.message}`; throw error }
  throw new Error("expected a refusal")
}

test("a listing is every file under the source, named relative to it", () => {
  withDir((dir) => files(dir, { "kernel.js": "export const k = 1", "nested/app.js": "export const a = 2" }), (dir) => {
    const listing = makeArtifactStore().publish("board@1.0.0", dir)
    expect(listing.id).toBe("board@1.0.0")
    expect(listing.files.map((file) => file.path)).toEqual(["kernel.js", "nested/app.js"])
    expect(listing.files.map((file) => file.bytes)).toEqual([18, 18])
    // The digest is over the listing, not over one file: two builds that differ
    // only by a renamed file are different artifacts.
    expect(listing.digest).toBe(listingDigest(listing.files))
  })
})

test("bytes come back byte for byte, and only for paths the listing named", () => {
  withDir((dir) => files(dir, { "a.js": "hello" }), (dir) => {
    const store = makeArtifactStore()
    store.publish("board@1.0.0", dir)
    expect(new TextDecoder().decode(store.bytes("board@1.0.0", "a.js"))).toBe("hello")
    // Named, not merely absent: "unknown file" would leave an operator unable to
    // tell a bad path from a bad artifact.
    expect(refusal(() => store.bytes("board@1.0.0", "b.js"))).toBe("404 artifact board@1.0.0 has no file b.js")
  })
})

test("an artifact with no recorded directory says so, rather than reading as empty", () => {
  withDir(() => {}, () => {
    const store = makeArtifactStore()
    expect(store.listing("board@1.0.0")).toBeUndefined()
    expect(refusal(() => store.bytes("board@1.0.0", "a.js")))
      .toBe("404 no artifact bytes for board@1.0.0; nothing was published from a directory")
  })
})

test("a symlink is refused, not followed out of the published directory", () => {
  withDir((dir) => { files(dir, { "a.js": "1" }); symlinkSync("/etc/hosts", join(dir, "escape.js")) }, (dir) => {
    expect(refusal(() => makeArtifactStore().publish("board@1.0.0", dir))).toBe("400 artifact contains a symlink: escape.js")
  })
})

test("a source that is not a directory is refused by name", () => {
  withDir((dir) => files(dir, { "a.js": "1" }), (dir) => {
    expect(refusal(() => makeArtifactStore().publish("board@1.0.0", join(dir, "a.js"))))
      .toBe(`400 artifact source must be a directory: ${join(dir, "a.js")}`)
    expect(refusal(() => makeArtifactStore().publish("board@1.0.0", join(dir, "gone"))))
      .toBe(`400 artifact source does not exist: ${join(dir, "gone")}`)
  })
})

test("what has bytes is reported, which is not the same as what has been published", () => {
  withDir((dir) => files(dir, { "a.js": "1" }), (dir) => {
    const store = makeArtifactStore()
    store.publish("board@1.0.0", dir)
    store.publish("kernel@2.0.0", dir)
    expect(store.ids()).toEqual(["board@1.0.0", "kernel@2.0.0"])
  })
})
