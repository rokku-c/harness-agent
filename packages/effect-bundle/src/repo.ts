/**
 * The artifact repo's index — which kernel revision is active, which one it
 * displaced, and what each of them declared (docs/architecture-rework.md §6.1
 * "制品仓", §6.2 "commit(A 变 previous)").
 *
 * The index is deliberately dumb: two revisions and where their artifacts live.
 * It holds no behaviour, so a kernel can be rolled back by rewriting two fields
 * — and a boot that finds the active revision unusable can read the previous
 * one off the same file (§6.5-4).
 *
 * Writes are atomic (temp file + rename): a process that dies mid-write must
 * leave the previous index intact, never a half-written one. A torn index would
 * be worse than a stale one — it would lose both the active and the rollback
 * target at once.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { bundleRuntimes, type EffectRuntimeKind } from "./compat.ts"

/** One kernel artifact as the repo records it. */
export interface KernelRevision {
  readonly kernelId: string
  /** `effect-N` line this kernel implements toward its apps. */
  readonly abi: string
  /** `bootstrap-N` line this kernel needs from the host. */
  readonly bootstrapAbi: string
  readonly runtimes: readonly EffectRuntimeKind[]
  /** Monotonic per repo — what a push receipt compares (P6). */
  readonly revision: number
  /** Where the artifact lives (`<repo>/<kernelId>.effect-bundle`); the loader reads it. */
  readonly dir?: string
}

export interface KernelState {
  readonly active?: KernelRevision
  readonly previous?: KernelRevision
  /** Revisions this host has already failed to boot — not retried, and not overwritten. */
  readonly condemned?: readonly number[]
}

export interface KernelRepo {
  read(): KernelState
  write(state: KernelState): void
}

/** Normalize a partial declaration into a repo revision. */
export const kernelRevision = (
  declaration: { kernelId?: string; abi: string; bootstrapAbi: string; runtimes?: readonly EffectRuntimeKind[] },
  revision: number,
  dir?: string,
): KernelRevision => ({
  kernelId: declaration.kernelId ?? "(anonymous kernel)",
  abi: declaration.abi,
  bootstrapAbi: declaration.bootstrapAbi,
  runtimes: bundleRuntimes(declaration),
  revision,
  ...(dir === undefined ? {} : { dir }),
})

const EMPTY: KernelState = {}

export const makeMemoryKernelRepo = (initial: KernelState = EMPTY): KernelRepo => {
  let state = initial
  return { read: () => state, write: (next) => { state = next } }
}

/**
 * A `kernel-state.json` on disk. A missing file is an empty repo, not an error —
 * the first boot has nothing to record yet. A *corrupt* file is an error: we
 * refuse to guess which kernel to run.
 */
export const makeKernelStateFile = (file: string): KernelRepo => ({
  read: (): KernelState => {
    let raw: string
    try {
      raw = readFileSync(file, "utf8")
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") return EMPTY
      throw error
    }
    const parsed = JSON.parse(raw) as KernelState
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error(`effect-bundle: malformed kernel state at ${file}`)
    }
    return parsed
  },
  write: (state: KernelState): void => {
    mkdirSync(dirname(file), { recursive: true })
    const temp = `${file}.${process.pid}.tmp`
    writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8")
    renameSync(temp, file)
  },
})

/** The state file inside an artifact repo directory (§6.1's layout). */
export const kernelStatePath = (repoDir: string): string => join(repoDir, "kernel-state.json")
