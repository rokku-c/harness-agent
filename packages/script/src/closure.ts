/**
 * Visibility = dependency closure. Invariant: v ∈ V ⟹ v.deps ⊆ V.
 *
 * Both modes name a bound and then take the greatest closed subset of it, which
 * is what makes them converge:
 *   allowlist (default, safe): the seed, expanded along deps.
 *   denylist: the full set, less what the policy excludes.
 * Neither bound is closed on its own. A seed can name a tool whose dep the
 * registry does not have, and an exclusion can cut a chain in half; the tool
 * would stay visible while the thing it calls does not, and the agent would find
 * out at the call, with the tool set having read as valid throughout. Closing
 * drops that tool, and everything that depended on it, transitively.
 */
import type { Policy, ToolDef } from "./types.ts"

export type Registry = ReadonlyMap<string, ToolDef>

/** allowlist: the seed, expanded along deps. A name the registry lacks is not a tool. */
const expand = (registry: Registry, seed: ReadonlyArray<string>): ReadonlySet<string> => {
  const bound = new Set<string>()
  const queue = [...seed]
  while (queue.length > 0) {
    const name = queue.pop()!
    if (bound.has(name)) continue
    const tool = registry.get(name)
    if (tool === undefined) continue
    bound.add(name)
    for (const dep of tool.deps) queue.push(dep)
  }
  return bound
}

/** denylist: everything the registry has, less what the policy excludes. */
const except = (registry: Registry, excluded: ReadonlyArray<string>): ReadonlySet<string> => {
  const blocked = new Set(excluded)
  return new Set([...registry.keys()].filter((name) => !blocked.has(name)))
}

/** Validate that a tool is compliant with a given visible set (all deps must be inside it). */
export const violatesClosure = (tool: ToolDef, visible: ReadonlySet<string>): ReadonlyArray<string> =>
  tool.deps.filter((dep) => !visible.has(dep))

/** The greatest subset of `bound` every member of which has its deps inside it. */
const closeUnder = (registry: Registry, bound: ReadonlySet<string>): ReadonlyArray<string> => {
  const visible = new Set(bound)
  let changed = true
  while (changed) {
    changed = false
    for (const name of [...visible]) {
      const tool = registry.get(name)
      if (tool !== undefined && violatesClosure(tool, visible).length > 0) {
        visible.delete(name)
        changed = true
      }
    }
  }
  return [...visible]
}

/** Given a registry and a policy, compute the tool set visible to the current agent (closed under deps). */
export const visibleTools = (registry: Registry, policy: Policy): ReadonlyArray<string> =>
  policy.api.mode === "denylist"
    ? closeUnder(registry, except(registry, policy.api.scope))
    : closeUnder(registry, expand(registry, policy.api.scope))
