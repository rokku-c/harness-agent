/**
 * The one credential check, in one place (§8.5-1).
 *
 * The node token is one secret compared by every node-facing verb: a second copy
 * of this comparison is a second place to get it wrong, and the failure would be
 * silent in exactly one of them.
 *
 * Constant-time in the comparison itself: a wrong token of the right length cannot
 * be narrowed byte by byte. The length check in front of it short-circuits, so the
 * token's length is not hidden — which a fixed-length shared secret has usually
 * given away already. Keeping the claim about the comparison rather than about
 * this function is the point.
 */

import { timingSafeEqual } from "node:crypto"

export const sameToken = (left: string, right: string): boolean => {
  const a = Buffer.from(left), b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
