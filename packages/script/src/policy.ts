/**
 * Configuration = one Policy type (the homoiconic core).
 * - mergePolicy(system, agentOverride): an agent may only override the dot paths listed in
 *   allowAgentConfig (system switches are granular down to each fine-grained item).
 * - restrictPolicy(parent, childScope): derivation = narrowing + inheritance (api intersection,
 *   allowAgentConfig intersection); a root agent controls scope this way when deriving child agents.
 * - Shares the same "scope + policy" pattern as visibleTools (tool layer) and resolve (version layer).
 */
import type { Policy } from "./types.ts"
import { defaultCompat, defaultPolicy } from "./types.ts"

const copy = (policy: Policy): Policy => JSON.parse(JSON.stringify(policy)) as Policy

/** Get/set by dot path ("compat.schema", "version.defaults.weather"). */
const getPath = (object: unknown, path: string): unknown => {
  let cursor: unknown = object
  for (const segment of path.split(".")) {
    if (cursor === null || typeof cursor !== "object") return undefined
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return cursor
}

const setPath = (object: unknown, path: string, value: unknown): void => {
  const segments = path.split(".")
  let cursor = object as Record<string, unknown>
  for (const segment of segments.slice(0, -1)) {
    const next = cursor[segment]
    if (next === null || typeof next !== "object") {
      const fresh: Record<string, unknown> = {}
      cursor[segment] = fresh
      cursor = fresh
    } else {
      cursor = next as Record<string, unknown>
    }
  }
  cursor[segments.at(-1)!] = value
}

/** System config + agent override: an agent may only override whitelisted paths. */
export const mergePolicy = (system: Policy, agent: Partial<Policy>): Policy => {
  const out = copy(system)
  for (const path of system.allowAgentConfig) {
    const value = getPath(agent, path)
    if (value !== undefined) setPath(out, path, value)
  }
  return out
}

/** Derivation: scope narrows layer by layer (api intersection + allowAgentConfig intersection); the rest is inherited. */
export const restrictPolicy = (
  parent: Policy,
  childScope: { readonly api?: ReadonlyArray<string>; readonly allowAgentConfig?: ReadonlyArray<string> }
): Policy => {
  const out = copy(parent)
  if (childScope.api !== undefined) {
    const allowed = new Set(childScope.api)
    // readonly structure: narrow it through a mutable view
    ;(out.api as unknown as { scope: string[] }).scope = parent.api.scope.filter((name) => allowed.has(name))
  }
  if (childScope.allowAgentConfig !== undefined) {
    const allowed = new Set(childScope.allowAgentConfig)
    ;(out as unknown as { allowAgentConfig: string[] }).allowAgentConfig = parent.allowAgentConfig.filter((path) => allowed.has(path))
  }
  return out
}

/** Convenience: build a base policy (defaults + overrides). */
export const policy = (overrides: Partial<Policy>): Policy => ({
  ...defaultPolicy,
  compat: { ...defaultCompat, ...overrides.compat },
  ...overrides
})

export { defaultCompat, defaultPolicy }
