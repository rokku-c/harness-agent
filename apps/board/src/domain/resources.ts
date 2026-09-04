/** domain/resources.ts - what the board governs.
 *  Concept: exclusive resources allow exactly one holder at a time; shared
 *  resources allow many holders up to capacity. An item declares Resource-
 *  Claims while doing - the governor grants the whole group atomically. */
export type ResourceKind = "workspace" | "slot" | "external"
export type Concurrency = "exclusive" | "shared"

export interface Resource {
  readonly resourceId: string
  readonly kind: ResourceKind
  readonly name: string
  /** how much of this resource exists in total */
  readonly capacity: number
  /** exclusive: one holder at a time; shared: many holders up to capacity */
  readonly concurrency: Concurrency
  readonly description?: string
}

export interface ResourceClaim {
  readonly resourceId: string
  /** how much of the resource this item needs (<= resource.capacity) */
  readonly amount?: number
}
