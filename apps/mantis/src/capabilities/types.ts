import type { Tier } from "../supply.ts"
import type { WorkKind } from "../workspace.ts"

export type CapabilityImpl =
  | "catalog"
  | "enable"
  | "notes.search"
  | "notes.read"
  | "resource.append"
  | "resource.update"
  | "resource.delete"

export interface CapabilityDecl {
  readonly name: string
  readonly tier: Tier
  readonly description: string
  readonly impl: CapabilityImpl
  readonly kind?: WorkKind
}
