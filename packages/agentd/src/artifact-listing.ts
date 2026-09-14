import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { AgentdError } from "./errors.ts"

export interface ArtifactFile {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

export interface ArtifactListing {
  readonly id: string
  readonly digest: string
  readonly files: readonly ArtifactFile[]
}

const sha256 = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex")

export const listingDigest = (files: readonly Pick<ArtifactFile, "path" | "sha256">[]): string =>
  sha256([...files].sort((a, b) => (a.path < b.path ? -1 : 1)).map((file) => `${file.sha256}  ${file.path}\n`).join(""))

const walk = (root: string, at: string = root): readonly ArtifactFile[] => {
  const found: ArtifactFile[] = []
  for (const entry of readdirSync(at, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = join(at, entry.name)
    const path = full.slice(root.length + 1).split(/[\\/]/).join("/")
    if (entry.isSymbolicLink()) throw new AgentdError(400, `artifact contains a symlink: ${path}`)
    if (entry.isDirectory()) found.push(...walk(root, full))
    else if (entry.isFile()) found.push({ path, bytes: statSync(full).size, sha256: sha256(readFileSync(full)) })
    else throw new AgentdError(400, `artifact contains something that is not a file: ${path}`)
  }
  return found
}

export const readListing = (id: string, source: string): ArtifactListing => {
  const stats = statSync(source, { throwIfNoEntry: false })
  if (stats === undefined) throw new AgentdError(400, `artifact source does not exist: ${source}`)
  if (!stats.isDirectory()) throw new AgentdError(400, `artifact source must be a directory: ${source}`)
  const files = walk(source)
  return { id, digest: listingDigest(files), files }
}
