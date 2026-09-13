/**
 * The name a caller sees — one reduction, two surfaces.
 *
 * A served name is a tool's or a view's own name reduced to what MCP allows, and
 * the reduction is not injective: `Formal/ToolKey.lean`
 * (`two_names_can_serve_as_one_name`) exhibits two names with one served name.
 * A surface that let the later registration win would drop something it still
 * advertises, so taking a served name refuses a name already taken and names
 * both holders. The tools surface and the resources surface ask this one
 * question here instead of each answering it their own way.
 */

/** The name MCP accepts: every run outside `[A-Za-z0-9_-]` becomes one `_`. */
export const sanitize = (name: string): string => name.replace(/[^A-Za-z0-9_-]+/g, "_")

/**
 * A hander-out of served names for one surface. `owner` is what a refusal names
 * — the tool key, or the view id — so the two ids that collided are both in the
 * message rather than only the name they share.
 */
export const makeServedNames = (what: string): ((owner: string, name: string) => string) => {
  const held = new Map<string, string>()
  return (owner, name) => {
    const served = sanitize(name)
    const other = held.get(served)
    if (other !== undefined) {
      throw new Error(`${what} "${other}" and "${owner}" both serve as "${served}"; rename one of them`)
    }
    held.set(served, owner)
    return served
  }
}
