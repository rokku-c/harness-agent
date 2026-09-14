import { createHash } from "node:crypto"
import { AgentdError } from "./errors.ts"
import { listingDigest } from "./artifact-listing.ts"
import type { ArtifactStore } from "./artifacts.ts"

export interface WireFile {
  readonly path: string
  readonly sha256: string
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
