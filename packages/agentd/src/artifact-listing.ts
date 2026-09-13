/**
 * What an artifact contains (§7.6, P6): its files, and the digest that is its
 * identity as *content*.
 *
 * A compiled artifact is a directory — `KernelRevision.dir` joins `kernel.js`
 * into it, `compileEffectBundle` writes `<outDir>/<bundleId>.effect-bundle/` —
 * so "listing" means walking one. Symlinks are refused rather than followed: a
 * node is handed these bytes, so following a link out of the published directory
 * would turn "publish a directory" into "publish whatever that path can reach".
 *
 * `listingDigest` is defined once and used by both ends of the wire, because a
 * digest is a *contract*: a node that computed it differently would report every
 * artifact on the fleet as corrupt, and the bug would look like a fleet-wide
 * failure rather than a mismatched encoder.
 */

import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { AgentdError } from "./errors.ts"

/** One file inside an artifact: its path *within* the artifact, and its digest. */
export interface ArtifactFile {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

export interface ArtifactListing {
  /** `bundleId@version`, the same identity the registry publishes under. */
  readonly id: string
  /** One digest over the whole listing — the artifact's identity as *content*. */
  readonly digest: string
  readonly files: readonly ArtifactFile[]
}

const sha256 = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex")

/** One digest over every file, in path order so the answer does not depend on readdir. */
export const listingDigest = (files: readonly Pick<ArtifactFile, "path" | "sha256">[]): string =>
  sha256([...files].sort((a, b) => (a.path < b.path ? -1 : 1)).map((file) => `${file.sha256}  ${file.path}\n`).join(""))

/** Every regular file under `root`, as artifact-relative POSIX paths. */
const walk = (root: string, at: string = root): readonly ArtifactFile[] => {
  const found: ArtifactFile[] = []
  for (const entry of readdirSync(at, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = join(at, entry.name)
    const path = full.slice(root.length + 1).split(/[\\/]/).join("/")
    // Refused, not skipped: an artifact that silently lost a file would be a
    // deployment that silently lost a file.
    if (entry.isSymbolicLink()) throw new AgentdError(400, `artifact contains a symlink: ${path}`)
    if (entry.isDirectory()) found.push(...walk(root, full))
    else if (entry.isFile()) found.push({ path, bytes: statSync(full).size, sha256: sha256(readFileSync(full)) })
    else throw new AgentdError(400, `artifact contains something that is not a file: ${path}`)
  }
  return found
}

/** Read a directory into a listing. The only place a published source is inspected. */
export const readListing = (id: string, source: string): ArtifactListing => {
  const stats = statSync(source, { throwIfNoEntry: false })
  if (stats === undefined) throw new AgentdError(400, `artifact source does not exist: ${source}`)
  if (!stats.isDirectory()) throw new AgentdError(400, `artifact source must be a directory: ${source}`)
  const files = walk(source)
  return { id, digest: listingDigest(files), files }
}
