/**
 * How an artifact crosses the process boundary (§8.2, P6).
 *
 * One definition for both ends, because the digest is a *contract*: a node that
 * computed it differently from the control plane would report every artifact on
 * the fleet as corrupt, and the bug would look like a fleet-wide failure rather
 * than a mismatched encoder.
 *
 * The envelope is JSON, like every other word on this wire (`transport.ts` is
 * JSON end to end), with each file's bytes base64. A tar would be smaller on the
 * wire and would also mean this repository owning a tar implementation — a
 * compiled bundle is a handful of KB, so the honest trade is the boring format.
 *
 * What `fromWire` proves is **integrity, not authenticity**: the bytes are the
 * ones the listing describes. Whether the listing *should* be trusted is the
 * `nodeToken` question (§8.5-1) and is not re-answered here.
 */

import { createHash } from "node:crypto"
import { AgentdError } from "./errors.ts"
import { listingDigest } from "./artifact-listing.ts"
import type { ArtifactStore } from "./artifacts.ts"

export interface WireFile {
  readonly path: string
  readonly sha256: string
  /** base64 of the file's bytes. */
  readonly content: string
}

export interface WireArtifact {
  readonly id: string
  readonly digest: string
  readonly files: readonly WireFile[]
}

export interface DecodedArtifact {
  readonly id: string
  readonly digest: string
  readonly files: readonly { readonly path: string; readonly bytes: Uint8Array }[]
}

const sha256 = (data: Uint8Array): string => createHash("sha256").update(data).digest("hex")

/**
 * Read a whole artifact out of the store, digests included.
 *
 * The digests are the ones recorded at publish time while the bytes are read
 * now, so a source edited underneath a published version travels as a listing
 * that does not add up — and `fromWire` refuses it by name. That is the intended
 * failure: a node that got half of the new build would run half of the new build.
 */
export const toWire = (store: ArtifactStore, id: string): WireArtifact => {
  const listing = store.listing(id)
  if (listing === undefined) throw new AgentdError(404, `no artifact bytes for ${id}; nothing was published from a directory`)
  return {
    id: listing.id,
    digest: listing.digest,
    files: listing.files.map((file) => ({
      path: file.path,
      sha256: file.sha256,
      content: Buffer.from(store.bytes(id, file.path)).toString("base64"),
    })),
  }
}

/**
 * Turn a response back into files, and refuse anything that does not add up.
 *
 * A half-written artifact is worse than a missing one — the loader would try to
 * import it — so this returns bytes only once every file and the listing itself
 * have matched, and the caller writes nothing until then.
 */
export const fromWire = (value: unknown): DecodedArtifact => {
  const artifact = value as WireArtifact | null
  if (artifact === null || typeof artifact !== "object" || !Array.isArray(artifact.files) || typeof artifact.id !== "string") {
    throw new AgentdError(400, "malformed artifact response")
  }
  const files = artifact.files.map((file) => {
    const bytes = Buffer.from(file.content, "base64")
    const actual = sha256(bytes)
    if (actual !== file.sha256) {
      throw new AgentdError(400, `artifact ${artifact.id} file ${file.path} does not match its digest (${file.sha256} → ${actual})`)
    }
    return { path: file.path, bytes, sha256: actual }
  })
  const digest = listingDigest(files)
  if (digest !== artifact.digest) {
    throw new AgentdError(400, `artifact ${artifact.id} does not match its listing digest (${artifact.digest} → ${digest})`)
  }
  return { id: artifact.id, digest, files: files.map(({ path, bytes }) => ({ path, bytes })) }
}
