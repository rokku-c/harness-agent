import type { Policy, ToolDef } from "./types.ts"

export type Registry = ReadonlyMap<string, ToolDef>

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

const except = (registry: Registry, excluded: ReadonlyArray<string>): ReadonlySet<string> => {
  const blocked = new Set(excluded)
  return new Set([...registry.keys()].filter((name) => !blocked.has(name)))
}

export const violatesClosure = (tool: ToolDef, visible: ReadonlySet<string>): ReadonlyArray<string> =>
  tool.deps.filter((dep) => !visible.has(dep))

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

export const visibleTools = (registry: Registry, policy: Policy): ReadonlyArray<string> =>
  policy.api.mode === "denylist"
    ? closeUnder(registry, except(registry, policy.api.scope))
    : closeUnder(registry, expand(registry, policy.api.scope))
