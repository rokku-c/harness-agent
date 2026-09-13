/**
 * P6 end to end: a real probe, against a real control plane, installing a real
 * artifact it has never had.
 *
 * Until this path existed the push side was metadata end to end — a node could be
 * told what to run, adjudicated, and receipted, with no way to get the bytes. So
 * the property under test is not "the route answers" but "a file that was never
 * on this machine is now on it", and, in the second case, that a version whose
 * source changed underneath it installs nothing rather than half a build.
 */

import { expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { startStandaloneApp } from "@effect-agent/effect-standalone"
import { startProbe } from "@effect-agent/agentd-probe"
import { effectApp } from "../src/effect-app.ts"
import { DECLARED, receipts, TOKEN, until } from "./probe-plane.ts"

const scratch = (prefix: string): string => mkdtempSync(join(tmpdir(), prefix))
const config = (source: string) => ({
  nodeToken: TOKEN,
  machines: [{ machineId: "m1", name: "workshop-1", capabilities: ["abi:effect-1", "runtime:os"], namespaces: ["ops"] }],
  bundles: [{ bundleId: "board", version: "1.0.0", abi: "effect-1", source }],
  nodeBindings: [{ nodeId: "m1", apps: [{ bundleId: "board", version: "1.0.0", ns: "ops" }] }],
})
interface Staged { readonly staged: ReadonlyArray<{ readonly id: string; readonly dir: string; readonly files: number }> }

test("a probe installs an artifact the machine has never had", async () => {
  const source = scratch("agentd-source-"), root = scratch("agentd-root-")
  writeFileSync(join(source, "entry.os.js"), "export const a = 1")
  const hosted = await startStandaloneApp({ app: effectApp, appRoutes: true, port: 0, config: config(source) })
  const probe = startProbe({ url: hosted.url, token: TOKEN, machine: DECLARED, intervalMs: 100, stage: root })
  try {
    // Nothing is on the machine yet, so whatever ends up here was fetched.
    expect(existsSync(join(root, "board@1.0.0.effect-bundle"))).toBe(false)
    const applied = await until(async () => { const held = await receipts(hosted.url); return held.length > 0 ? held : undefined })
    expect(applied[0]!.state.ok).toBe(true)
    expect(readFileSync(join(root, "board@1.0.0.effect-bundle", "entry.os.js"), "utf8")).toBe("export const a = 1")
    // The receipt says where it went, so an operator reading the control plane can
    // tell which build each machine is holding.
    expect((applied[0]!.state.deployment as unknown as Staged).staged.map((item) => [item.id, item.files]))
      .toEqual([["board@1.0.0", 1]])
  } finally {
    await probe.stop(); await hosted.stop(); rmSync(source, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true })
  }
})

test("a version whose source changed underneath it installs nothing, and says why", async () => {
  const source = scratch("agentd-source-"), root = scratch("agentd-root-")
  writeFileSync(join(source, "entry.os.js"), "as published")
  const hosted = await startStandaloneApp({ app: effectApp, appRoutes: true, port: 0, config: config(source) })
  // Rebuilt in place after the control plane read the listing: the bytes a node
  // would receive are no longer the ones the version was published as.
  writeFileSync(join(source, "entry.os.js"), "rebuilt")
  const probe = startProbe({ url: hosted.url, token: TOKEN, machine: DECLARED, intervalMs: 100, stage: root })
  try {
    const applied = await until(async () => { const held = await receipts(hosted.url); return held.length > 0 ? held : undefined })
    expect(applied[0]!.state.ok).toBe(false)
    expect(applied[0]!.state.error).toStartWith("artifact board@1.0.0 file entry.os.js does not match its digest")
    // Refused before anything was written, which is the whole point: a node with
    // half of the new build on disk is worse off than one with none of it.
    expect(existsSync(join(root, "board@1.0.0.effect-bundle"))).toBe(false)
  } finally {
    await probe.stop(); await hosted.stop(); rmSync(source, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true })
  }
})
