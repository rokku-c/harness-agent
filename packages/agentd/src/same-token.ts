/**
 * The one credential check, in one place (§8.5-1).
 *
 * The node token is one secret compared by every node-facing verb: a second copy
 * of this comparison is a second place to get it wrong, and the failure would be
 * silent in exactly one of them. Constant-time, so a wrong token cannot be
 * narrowed by how long the comparison took.
 */

import { timingSafeEqual } from "node:crypto"

export const sameToken = (left: string, right: string): boolean => {
  const a = Buffer.from(left), b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
