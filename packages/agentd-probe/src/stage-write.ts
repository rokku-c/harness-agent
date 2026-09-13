/**
 * Where an artifact's bytes land on this machine (§8.2, P6) — the disk half of
 * staging, kept apart from `stage.ts` so that "is this deployment verifiable"
 * and "how does a directory get written" are answerable separately.
 */

import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

/**
 * Where a file from the wire goes here, refusing any path that climbs out of the
 * artifact's own directory: these paths are remote input and this is a write to
 * disk, so one crafted entry would otherwise pick the file to overwrite.
 */
const localOf = (staging: string, path: string): string => {
  const parts = path.split("/")
  if (path.startsWith("/") || parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`artifact path escapes its directory: ${path}`)
  }
  return join(staging, ...parts)
}

/**
 * Write a directory a reader never sees half-made: into a temporary sibling, then
 * rename over the target. The removal first is not atomic and is the smaller evil
 * — that gap leaves the artifact *absent*, a clean "not staged", where a merged
 * directory would be a build nobody built.
 */
export const writeArtifactDir = (
  dir: string, files: readonly { readonly path: string; readonly bytes: Uint8Array }[],
): void => {
  const staging = `${dir}.staging`
  rmSync(staging, { recursive: true, force: true })
  for (const file of files) {
    const target = localOf(staging, file.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.bytes)
  }
  rmSync(dir, { recursive: true, force: true })
  renameSync(staging, dir)
}
