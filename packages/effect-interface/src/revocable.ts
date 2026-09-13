/**
 * Reversible registration: put `value` under `id` in `map`, and get back the one
 * call that takes it out again.
 *
 * That call is inert once a later registration has taken the id. Without the
 * check, the teardown of a version that was replaced turns off the version that
 * replaced it — a reload is exactly that run, since it claims an id that is
 * still claimed.
 *
 * Identity is a per-registration token, not the value: a replacement may be
 * indistinguishable from what it replaced (the same interface object registered
 * twice, an identical UI view), and two equal registrations are still two.
 */

/** The token each map's registrations are told apart by. Keyed by the map, so
 *  an id means nothing outside the map it was registered in. */
const tokens = new WeakMap<object, Map<string, object>>()

export const revocable = <T>(map: Map<string, T>, id: string, value: T): (() => void) => {
  let byId = tokens.get(map)
  if (byId === undefined) tokens.set(map, (byId = new Map()))
  const token = {}
  byId.set(id, token)
  map.set(id, value)
  return () => {
    if (byId.get(id) !== token) return
    byId.delete(id)
    // the token says this registration is the newest; the value says the map
    // still holds it, in case something wrote `map` without going through here
    if (map.get(id) === value) map.delete(id)
  }
}
