/**
 * model/version-refs.ts - DEPENDENCY REFERENCES and version objects.
 *
 * Concept: a dep points at a tool version one of four ways (latest/revision/
 * hash/range); a Version is the immutable record of one revision - content
 * addressed (SHA-256 over canonical content + dep hashes) so the closure is
 * locked by the hash itself.
 */
import type { ToolDef } from "./tool.ts"
export type Ref =
  | { readonly kind: "latest" }
  | { readonly kind: "revision"; readonly n: number }
  | { readonly kind: "hash"; readonly hash: string }
  | { readonly kind: "range"; readonly spec: string }

export interface Dep {
  readonly name: string
  readonly ref: Ref
}

export const refToShort = (ref: Ref): string => {
  switch (ref.kind) {
    case "latest": return "latest"
    case "revision": return "rev:" + ref.n
    case "hash": return ref.hash.slice(0, 8)
    case "range": return ref.spec
  }
}

export interface Version {
  readonly tool: string
  readonly revision: number
  /** SHA-256(canonical content + dep hashes) - content addressing that locks the dependency closure */
  readonly hash: string
  readonly parent?: string
  readonly message: string
  readonly content: ToolDef
  readonly createdAt: number
  /** Version visibility: experimental versions can be hidden from specific agents */
  readonly hidden?: boolean
}

export type VersionVisibility = "public" | "hidden" | "restricted"
