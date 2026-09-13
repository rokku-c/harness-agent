import { expect, test } from "bun:test"
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  BOOTSTRAP_ABI,
  kernelRevision,
  kernelStatePath,
  makeKernelStateFile,
  makeMemoryKernelRepo,
} from "../src/index.ts"

const withDir = (body: (dir: string) => void) => {
  const dir = mkdtempSync(join(tmpdir(), "effect-repo-"))
  try {
    body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const rev = kernelRevision({ kernelId: "kernel-a", abi: "effect-1", bootstrapAbi: BOOTSTRAP_ABI }, 1)

test("a missing state file is an empty repo, not an error", () => {
  withDir((dir) => {
    expect(makeKernelStateFile(kernelStatePath(dir)).read()).toEqual({})
  })
})

test("the index round-trips active and previous", () => {
  withDir((dir) => {
    const repo = makeKernelStateFile(kernelStatePath(dir))
    const previous = kernelRevision({ kernelId: "kernel-b", abi: "effect-1", bootstrapAbi: BOOTSTRAP_ABI }, 2)

    repo.write({ active: rev, previous })
    expect(repo.read()).toEqual({ active: rev, previous })
  })
})

test("writing leaves no temp file behind", () => {
  withDir((dir) => {
    const repo = makeKernelStateFile(kernelStatePath(dir))
    repo.write({ active: rev })
    repo.write({ previous: rev })

    expect(readdirSync(dir).sort()).toEqual(["kernel-state.json"])
  })
})

test("a corrupt index is refused rather than guessed at", () => {
  withDir((dir) => {
    const file = kernelStatePath(dir)
    writeFileSync(file, "{ not json")
    expect(() => makeKernelStateFile(file).read()).toThrow()
  })
})

test("a revision carries the conservative runtime default", () => {
  expect(rev.runtimes).toEqual(["os"])
  expect(kernelRevision({ kernelId: "k", abi: "effect-2", bootstrapAbi: "bootstrap-1", runtimes: ["browser"] }, 3, "/tmp/k"))
    .toEqual({
      kernelId: "k",
      abi: "effect-2",
      bootstrapAbi: "bootstrap-1",
      runtimes: ["browser"],
      revision: 3,
      dir: "/tmp/k",
    })
})

test("an anonymous revision still gets a name for logs and receipts", () => {
  expect(kernelRevision({ abi: "effect-1", bootstrapAbi: "bootstrap-1" }, 1).kernelId).toBe("(anonymous kernel)")
})

test("the in-memory repo is the same shape as the file one", () => {
  const repo = makeMemoryKernelRepo()
  expect(repo.read()).toEqual({})
  repo.write({ active: rev })
  expect(repo.read().active?.kernelId).toBe("kernel-a")
})
