/**
 * One temp workspace for the kernel-swap tests: an artifact repo, a SQLite file,
 * and a manifest root holding the deployed apps §5's matrix adjudicates.
 *
 * Shared by `kernel-swap.test.ts` (①/② swap semantics) and `kernel-suspend.test.ts`
 * (§6.5-6: which apps a swap actually takes down), so both describe the same
 * machine rather than two subtly different ones.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { BOOTSTRAP_ABI, KERNEL_ABI, kernelRevision, type KernelRevision } from "@effect-agent/effect-bundle"
import { bootRuntime } from "../src/boot/runtime.ts"
import { writeApp, type AppSpec } from "./swap-app.ts"

export type { AppSpec } from "./swap-app.ts"

export const req = (path: string, init?: RequestInit) => new Request("http://effect" + path, init)

/** Wait for a condition the fixture reports, without pinning the test to a delay. */
export const until = async (ready: () => boolean, timeoutMs = 2000): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (!ready()) {
    if (Date.now() > deadline) throw new Error("timed out waiting for the fixture")
    await Bun.sleep(2)
  }
}

export const revisionFor = (kernelId: string, revision: number, dir?: string, abi = KERNEL_ABI): KernelRevision =>
  kernelRevision({ kernelId, abi, bootstrapAbi: BOOTSTRAP_ABI, runtimes: ["os"] }, revision, dir)

export interface Workspace {
  readonly stateFile: string
  readonly configFile: string
  /** Write a kernel artifact directory and answer with its path. */
  artifact(name: string, source: string): string
  /** Add a deployed app to the manifest root, and answer with that root. */
  appRoot(app: AppSpec): string
}

export const withWorkspace = async (body: (workspace: Workspace) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), "effect-kernel-"))
  try {
    await body({
      stateFile: join(dir, "kernel-state.json"),
      configFile: join(dir, "config.sqlite"),
      artifact: (name, source) => {
        const artifact = join(dir, name)
        mkdirSync(artifact, { recursive: true })
        writeFileSync(join(artifact, "kernel.js"), source)
        return artifact
      },
      appRoot: (app) => {
        const root = join(dir, "apps")
        mkdirSync(root, { recursive: true })
        writeApp(root, app)
        return root
      },
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export const boot = (
  options: { stateFile?: string; configFile: string; roots?: readonly string[] },
  enabled = ["config"],
) => bootRuntime(options.roots ?? ["/nonexistent-root"], new Set(enabled), {
  configFile: options.configFile,
  ...(options.stateFile === undefined ? {} : { kernelStateFile: options.stateFile }),
})
