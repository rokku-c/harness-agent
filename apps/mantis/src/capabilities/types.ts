/**
 * capabilities/types.ts - the CAPABILITY DECL CONTRACT.
 *
 * Concept: one manifest entry declares an op the session agent can perform
 * (impl branch), the context-economy tier it lives in, and the model-facing
 * description. The whole product surface is assembled from entries of this
 * shape - nothing about the tool surface is hardcoded elsewhere.
 */
import type { Tier } from "../supply.ts"
import type { WorkKind } from "../workspace.ts"

/** how the session agent implements a manifest entry */
export type CapabilityImpl =
  | "catalog"          // list the tool surface
  | "enable"           // activate an extended tool
  | "notes.search"     // search every workspace entry (note/reminder/task)
  | "notes.read"       // read the whole workspace
  | "resource.append"  // append one record to a declared workspace resource
  | "resource.update"  // change one existing record's text (generic by id)
  | "resource.delete"  // delete one existing record (generic by id)

export interface CapabilityDecl {
  /** op name (unique) */
  readonly name: string
  /** context-economy tier: core is always visible, extended needs enable */
  readonly tier: Tier
  /** model-facing description shown in catalog + op surface */
  readonly description: string
  /** the implementation branch in the session agent */
  readonly impl: CapabilityImpl
  /** for impl "resource.append": which declared resource this appends to */
  readonly kind?: WorkKind
}
