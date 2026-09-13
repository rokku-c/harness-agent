/**
 * P6 at the control plane: publishing is one act, and the bytes are the half of
 * it that a node actually receives.
 *
 * The cases that matter are the ones where the two halves could come apart — a
 * refused publish that still recorded a directory, a repeat publish that swapped
 * the content under a version already taken, and a fetch that nobody's credential
 * was required for.
 */

import { expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AgentdError, fromWire, makeAgentdControl } from "../src/index.ts"

const TOKEN = "fleet-secret"
const withDir = <T>(content: string, run: (dir: string) => T): T => {
  const root = mkdtempSync(join(tmpdir(), "publish-"))
  try { writeFileSync(join(root, "app.js"), content); return run(root) } finally { rmSync(root, { recursive: true, force: true }) }
}
const app = { bundleId: "board", version: "1.0.0", abi: "effect-1" }
const refusal = (run: () => unknown): string => {
  try { run() } catch (error) { if (error instanceof AgentdError) return `${error.status} ${error.message}`; throw error }
  throw new Error("expected a refusal")
}
const contentOf = (control: ReturnType<typeof makeAgentdControl>, id: string, token?: string): string =>
  new TextDecoder().decode(fromWire(control.artifact(id, token)).files[0]!.bytes)

test("a version published from a directory can be fetched; one published without one cannot", () => {
  withDir("export const a = 1", (dir) => {
    const control = makeAgentdControl()
    control.publishBundle(app, dir)
    // A kernel, published as metadata only — a version this fleet already has.
    control.publishBundle({ bundleId: "host", version: "1.0.0", abi: "effect-1", kind: "kernel", bootstrapAbi: "effect-1" })
    expect(contentOf(control, "board@1.0.0")).toBe("export const a = 1")
    expect(refusal(() => control.artifact("host@1.0.0")))
      .toBe("404 no artifact bytes for host@1.0.0; nothing was published from a directory")
  })
})

test("a second publish of one version is refused, and does not swap the bytes under it", () => {
  withDir("export const a = 1", (first) => withDir("export const a = 2", (second) => {
    const control = makeAgentdControl()
    control.publishBundle(app, first)
    expect(refusal(() => control.publishBundle(app, second))).toBe("409 bundle already published")
    // The point of the refusal: every node that took this version is holding the
    // first bytes, and a version that quietly became a different build would make
    // "board@1.0.0" mean two things at once.
    expect(contentOf(control, "board@1.0.0")).toBe("export const a = 1")
  }))
})

test("a publish the registry refuses records no bytes at all", () => {
  withDir("export const a = 1", (dir) => {
    const control = makeAgentdControl()
    expect(refusal(() => control.publishBundle({ ...app, bootstrapAbi: "effect-1" }, dir)))
      .toBe("400 app bundle must not declare bootstrapAbi; that line is host↔kernel")
    expect(refusal(() => control.artifact("board@1.0.0")))
      .toBe("404 no artifact bytes for board@1.0.0; nothing was published from a directory")
  })
})

test("the fleet credential covers a byte fetch, and an unarmed guard says so by being open", () => {
  withDir("export const a = 1", (dir) => {
    const armed = makeAgentdControl({ nodeToken: TOKEN })
    armed.publishBundle(app, dir)
    expect(refusal(() => armed.artifact("board@1.0.0"))).toBe("401 unauthorized artifact fetch")
    expect(refusal(() => armed.artifact("board@1.0.0", "wrong"))).toBe("401 unauthorized artifact fetch")
    expect(contentOf(armed, "board@1.0.0", TOKEN)).toBe("export const a = 1")

    const unarmed = makeAgentdControl()
    unarmed.publishBundle(app, dir)
    expect(contentOf(unarmed, "board@1.0.0")).toBe("export const a = 1")
  })
})

test("fetching a version is a read, not a desired-state change", () => {
  withDir("export const a = 1", (dir) => {
    const control = makeAgentdControl()
    control.publishBundle(app, dir)
    const before = (control.status() as { revision: number }).revision
    control.artifact("board@1.0.0")
    // A read that bumped the revision would invalidate every in-flight receipt,
    // which is the deployment-breaking liveness bug with a different trigger.
    expect((control.status() as { revision: number }).revision).toBe(before)
    expect((control.status() as { artifactIds: readonly string[] }).artifactIds).toEqual(["board@1.0.0"])
  })
})
