/**
 * P6 on the machine: what actually lands on disk.
 *
 * The failure this file is about is a node that installed *part* of a deployment
 * and reported success — a machine running half of one build and half of the
 * next, with a receipt saying it was fine. The refusals are in
 * `stage-refusal.test.ts`; here it is the accepted cases.
 */

import { expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { stagingApply } from "../src/index.ts"
import { app, carries, controlOf, kernel, plan, wireOf, withScratch } from "./artifact-fixture.ts"

test("a whole deployment is installed, one directory per artifact, kernel first", async () => {
  await withScratch(async (root) => {
    const asked: string[] = []
    const control = controlOf({
      "host@1.0.0": wireOf("host@1.0.0", { "kernel.js": "boot" }),
      "board@1.0.0": wireOf("board@1.0.0", { "entry.os.js": "app", "nested/extra.js": "extra" }),
    }, asked)
    const staged = await stagingApply({ root, control })(plan(kernel, [app]))
    expect(asked).toEqual(["host@1.0.0", "board@1.0.0"])
    expect(carries(root, "host@1.0.0", "kernel.js")).toEqual(["boot"])
    // A nested path is written as a directory, not flattened into the name.
    expect(carries(root, "board@1.0.0", "entry.os.js", "nested/extra.js")).toEqual(["app", "extra"])
    expect(staged.staged.map((item) => [item.id, item.files])).toEqual([["host@1.0.0", 1], ["board@1.0.0", 2]])
    // The receipt says what the node now runs, resolved — not what it was told.
    expect(staged.deployment.apps.map((placed) => `${placed.ns}::${placed.bundleId}@${placed.version}`))
      .toEqual(["ops::board@1.0.0"])
  })
})

test("re-applying replaces the artifact instead of merging into the old one", async () => {
  await withScratch(async (root) => {
    const first = controlOf({ "board@1.0.0": wireOf("board@1.0.0", { "entry.os.js": "one", "gone.js": "stale" }) })
    await stagingApply({ root, control: first })(plan(undefined, [app]))
    const second = controlOf({ "board@1.0.0": wireOf("board@1.0.0", { "entry.os.js": "two" }) })
    await stagingApply({ root, control: second })(plan(undefined, [app]))
    expect(carries(root, "board@1.0.0", "entry.os.js")).toEqual(["two"])
    // A file the new version does not have must not survive from the old one: a
    // merged directory is a build nobody produced.
    expect(existsSync(join(root, "board@1.0.0.effect-bundle", "gone.js"))).toBe(false)
  })
})
