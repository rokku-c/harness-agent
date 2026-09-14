import { readFileSync } from "node:fs"
import { join } from "node:path"
import { AgentdError } from "./errors.ts"
import { readListing, type ArtifactListing } from "./artifact-listing.ts"

export interface ArtifactStore {
  publish(id: string, source: string): ArtifactListing
  listing(id: string): ArtifactListing | undefined
  bytes(id: string, path: string): Uint8Array
  ids(): readonly string[]
}

export const makeArtifactStore = (): ArtifactStore => {
  const held = new Map<string, { source: string; listing: ArtifactListing }>()
  return {
    publish(id, source) {
      const listing = readListing(id, source)
      held.set(id, { source, listing })
      return listing
    },
    listing: (id) => held.get(id)?.listing,
    bytes(id, path) {
      const artifact = held.get(id)
      if (artifact === undefined) throw new AgentdError(404, `no artifact bytes for ${id}; nothing was published from a directory`)
      if (!artifact.listing.files.some((file) => file.path === path)) {
        throw new AgentdError(404, `artifact ${id} has no file ${path}`)
      }
      return readFileSync(join(artifact.source, ...path.split("/")))
    },
    ids: () => [...held.keys()].sort(),
  }
}
