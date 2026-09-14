import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { bundleRuntimes, type EffectRuntimeKind } from "./compat.ts"

export interface KernelRevision {
  readonly kernelId: string
  readonly abi: string
  readonly bootstrapAbi: string
  readonly runtimes: readonly EffectRuntimeKind[]
  readonly revision: number
  readonly dir?: string
}

export interface KernelState {
  readonly active?: KernelRevision
  readonly previous?: KernelRevision
  readonly condemned?: readonly number[]
}

export interface KernelRepo {
  read(): KernelState
  write(state: KernelState): void
}

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

export const kernelStatePath = (repoDir: string): string => join(repoDir, "kernel-state.json")
