/** governor/claims.ts - PURE CLAIM FITNESS RULES.
 *  Concept: exclusive resources allow exactly one holder (the whole
 *  resource); shared resources allow many holders up to capacity; a claim
 *  group commits only if ALL of its claims fit (no partial grabs).
 *  commitClaims returns the next holdings map, or null when anything does
 *  not fit - atomicity is structural, no rollback exists. */
import type { Resource, ResourceClaim } from "../domain.ts"

const used = (holders: ReadonlyMap<string, number>): number =>
  [...holders.values()].reduce((a, b) => a + b, 0)

const claimFits = (resource: Resource, holders: ReadonlyMap<string, number>, amount: number): boolean => {
  if (resource.concurrency === "exclusive") {
    return holders.size === 0 && amount <= resource.capacity
  }
  return used(holders) + amount <= resource.capacity
}

/** would committing the whole claim group fit? returns next map or null */
export const commitClaims = (
  all: ReadonlyMap<string, ReadonlyMap<string, number>>,
  resourceMap: ReadonlyMap<string, Resource>,
  claims: ReadonlyArray<ResourceClaim>,
  itemId: string
): ReadonlyMap<string, ReadonlyMap<string, number>> | null => {
  const next = new Map(all)
  for (const claim of claims) {
    const resource = resourceMap.get(claim.resourceId)
    if (resource === undefined) return null
    const amount = Math.max(1, Math.min(claim.amount ?? 1, resource.capacity))
    const holders = next.get(claim.resourceId) ?? new Map<string, number>()
    if (!claimFits(resource, holders, amount)) return null
    next.set(claim.resourceId, new Map(holders).set(itemId, amount))
  }
  return next
}

/** drop everything an item holds; reports whether anything changed */
export const removeHoldings = (
  all: ReadonlyMap<string, ReadonlyMap<string, number>>,
  itemId: string
): { next: ReadonlyMap<string, ReadonlyMap<string, number>>; changed: boolean } => {
  const next = new Map(all)
  let changed = false
  for (const [resourceId, byItem] of all) {
    if (byItem.has(itemId)) {
      const updated = new Map(byItem)
      updated.delete(itemId)
      if (updated.size === 0) next.delete(resourceId)
      else next.set(resourceId, updated)
      changed = true
    }
  }
  return { next, changed }
}
