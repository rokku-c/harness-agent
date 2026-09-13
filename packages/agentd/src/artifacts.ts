/**
 * The artifact store (§7.6, P6): where a published bundle's *bytes* are.
 *
 * Before this file the push path was metadata end to end — `publishBundle` kept
 * a bundle id and its ABI lines, and the node was told *what* to run with no way
 * to get it. The missing half is a directory, which is exactly the shape the
 * kernel loader already takes (`<dir>/kernel.js`) and that `compileEffectBundle`
 * writes (`<outDir>/<bundleId>.effect-bundle/`).
 *
 * So the store holds a **reference**, not a copy. Copying would invent an
 * artifact lifecycle — a second place the same bytes live, and a garbage
 * collection question nobody has asked — to protect against the source
 * disappearing, which is instead *reported* when it happens. A reference that
 * has gone stale is a fact; a silently empty artifact is a lie.
 *
 * One version, one content is not decided here: the registry refuses a repeat of
 * `bundleId@version` before this store is reached (`bundle-registry.ts`), so a
 * second publish under one id would be a second writer to the same version, and
 * the place to stop that is the place that owns version identity.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { AgentdError } from "./errors.ts"
import { readListing, type ArtifactListing } from "./artifact-listing.ts"

export interface ArtifactStore {
  /** Record where this artifact's bytes live, and what they were when recorded. */
  publish(id: string, source: string): ArtifactListing
  listing(id: string): ArtifactListing | undefined
  /** One file's bytes, by a path the listing itself named. */
  bytes(id: string, path: string): Uint8Array
  /** Which artifacts have bytes at all, for `status()` — not the same as published. */
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
      // Named, not merely absent: "unknown artifact" would leave an operator
      // wondering whether the bundle was never published or published with no
      // directory to publish from.
      if (artifact === undefined) throw new AgentdError(404, `no artifact bytes for ${id}; nothing was published from a directory`)
      if (!artifact.listing.files.some((file) => file.path === path)) {
        throw new AgentdError(404, `artifact ${id} has no file ${path}`)
      }
      return readFileSync(join(artifact.source, ...path.split("/")))
    },
    ids: () => [...held.keys()].sort(),
  }
}
