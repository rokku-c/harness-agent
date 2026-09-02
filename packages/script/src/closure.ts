/**
 * Visibility = dependency closure. Invariant: v ∈ V ⟹ v.deps ⊆ V.
 * allowlist (default, safe): whitelist seed + closure expanded along deps.
 * denylist: full set − excluded set, then iteratively remove tools that break the closure
 * (excluding a tool → every tool that depends on it is removed transitively).
 * Both modes converge to the same invariant.
 */
import type { Policy } from "./types.ts"
import type { ToolDef } from "./types.ts"

export type Registry = ReadonlyMap<string, ToolDef>

/** allowlist mode: expand the closure from the seed along deps. */
const closureFromSeed = (registry: Registry, seed: ReadonlyArray<string>): ReadonlyArray<string> => {
  const visible = new Set<string>()
  const queue = [...seed]
  while (queue.length > 0) {
    const name = queue.pop()!
    if (visible.has(name)) continue
    const tool = registry.get(name)
    if (tool === undefined) continue
    visible.add(name)
    for (const dep of tool.deps) queue.push(dep)
  }
  return [...visible]
}

/** denylist mode: full set − excluded set, iteratively removing tools that break the closure. */
const closureFromDeny = (registry: Registry, blocked: ReadonlyArray<string>): ReadonlyArray<string> => {
  const blockedSet = new Set(blocked)
  const visible = new Set([...registry.keys()].filter((name) => !blockedSet.has(name)))
  let changed = true
  while (changed) {
    changed = false
    for (const name of [...visible]) {
      const tool = registry.get(name)
      if (tool !== undefined && tool.deps.some((dep) => !visible.has(dep))) {
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
    ? closureFromDeny(registry, policy.api.scope)
    : closureFromSeed(registry, policy.api.scope)

/** Validate that a tool is compliant with a given visible set (all deps must be inside it). */
export const violatesClosure = (tool: ToolDef, visible: ReadonlySet<string>): ReadonlyArray<string> =>
  tool.deps.filter((dep) => !visible.has(dep))
