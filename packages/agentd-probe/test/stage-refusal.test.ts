/**
 * P6 on the machine: what is refused before anything is written.
 *
 * Every case here ends the same way — the deployment is not applied, the previous
 * one is untouched, and the message names the file or the path that was wrong.
 * What is being protected is the same failure from `stage.test.ts`: a node that
 * installed half of one build and receipted success.
 */

import { expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { listingDigest } from "@effect-agent/agentd"
import { stagingApply } from "../src/index.ts"
import { app, controlOf, failure, kernel, plan, wireOf, withScratch } from "./artifact-fixture.ts"

test("one artifact that does not add up installs nothing, not even the good half", async () => {
  await withScratch(async (root) => {
    const good = wireOf("host@1.0.0", { "kernel.js": "boot" })
    const rotten = wireOf("board@1.0.0", { "entry.os.js": "app" })
    const control = controlOf({
      "host@1.0.0": good,
      "board@1.0.0": { ...rotten, files: [{ ...rotten.files[0]!, content: Buffer.from("tampered").toString("base64") }] },
    })
    expect(await failure(() => stagingApply({ root, control })(plan(kernel, [app]))))
      .toStartWith("artifact board@1.0.0 file entry.os.js does not match its digest")
    // The kernel arrived first and verified fine; it is still not on disk, because
    // a machine with the new kernel and the old apps is the mixture being avoided.
    expect(existsSync(join(root, "host@1.0.0.effect-bundle"))).toBe(false)
  })
})

test("a path that climbs out of the artifact is refused and writes nothing", async () => {
  await withScratch(async (root) => {
    // A listing that adds up — same bytes, same file digest — but whose path
    // names a file outside the artifact. Only the path check can catch this one.
    const good = wireOf("board@1.0.0", { "entry.os.js": "app" })
    const moved = { ...good.files[0]!, path: "../escape.js" }
    const control = controlOf({ "board@1.0.0": { id: good.id, digest: listingDigest([moved]), files: [moved] } })
    expect(await failure(() => stagingApply({ root, control })(plan(undefined, [app]))))
      .toBe("artifact path escapes its directory: ../escape.js")
    expect(existsSync(join(root, "..", "escape.js"))).toBe(false)
    expect(existsSync(join(root, "board@1.0.0.effect-bundle"))).toBe(false)
  })
})

test("a response that answers under another id is refused rather than filed", async () => {
  await withScratch(async (root) => {
    const control = controlOf({ "board@1.0.0": wireOf("other@1.0.0", { "entry.os.js": "app" }) })
    expect(await failure(() => stagingApply({ root, control })(plan(undefined, [app]))))
      .toBe("artifact fetch for board@1.0.0 answered with other@1.0.0")
  })
})
