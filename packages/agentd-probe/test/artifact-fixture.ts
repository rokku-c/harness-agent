/**
 * Fixtures for the staging tests: bytes built by the *real* store rather than
 * hand-rolled base64, and a plan as the adapter would emit one, so a test that
 * passes here is not passing because a fixture was forgiving.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { makeArtifactStore, toWire, type BundleArtifact, type NodeAdapterPlan, type WireArtifact } from "@effect-agent/agentd"
import type { NodeControl } from "../src/index.ts"

const unused = async (): Promise<never> => { throw new Error("staging does not call this") }
export const controlOf = (held: Record<string, WireArtifact>, asked: string[] = []): NodeControl =>
  ({ artifact: async (id) => { asked.push(id); return held[id]! }, announce: unused, heartbeat: unused, withdraw: unused, plan: unused, report: unused })

export const wireOf = (id: string, files: Record<string, string>): WireArtifact => {
  const source = mkdtempSync(join(tmpdir(), "source-"))
  try {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(source, path)), { recursive: true })
      writeFileSync(join(source, path), content)
    }
    const store = makeArtifactStore(); store.publish(id, source)
    return toWire(store, id)
  } finally { rmSync(source, { recursive: true, force: true }) }
}
export const app: BundleArtifact = { bundleId: "board", version: "1.0.0", abi: "effect-1", kind: "app", runtimes: ["os"] }
export const kernel: BundleArtifact = { bundleId: "host", version: "1.0.0", abi: "effect-1", kind: "kernel", runtimes: ["os"], bootstrapAbi: "effect-1" }
export const plan = (inKernel: BundleArtifact | undefined, apps: readonly BundleArtifact[]): NodeAdapterPlan => ({
  nodeId: "node-1", revision: 3, changes: [],
  desired: {
    nodeId: "node-1",
    ...(inKernel === undefined ? {} : { kernel: inKernel }),
    apps: apps.map((artifact) => ({ ...artifact, ns: "ops" })),
    metadata: { nodeId: "node-1", revision: 3 },
  },
})
export const withScratch = async <T>(run: (root: string) => Promise<T> | T): Promise<T> => {
  const root = mkdtempSync(join(tmpdir(), "stage-"))
  try { return await run(root) } finally { rmSync(root, { recursive: true, force: true }) }
}
export const carries = (root: string, id: string, ...paths: string[]): readonly string[] =>
  paths.map((path) => readFileSync(join(root, `${id}.effect-bundle`, ...path.split("/")), "utf8"))
export const failure = async (run: () => Promise<unknown>): Promise<string> => {
  try { await run() } catch (error) { return error instanceof Error ? error.message : String(error) }
  throw new Error("expected a refusal")
}
