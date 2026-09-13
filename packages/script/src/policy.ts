/**
 * Configuration = one Policy type (the homoiconic core).
 * - mergePolicy(system, agentOverride): an agent may only override the dot paths listed in
 *   allowAgentConfig (system switches are granular down to each fine-grained item).
 * - restrictPolicy(parent, childScope): derivation = narrowing + inheritance. The child sees no
 *   tool the parent did not, in EITHER mode - which is one rule and two operations, because a
 *   scope means the visible names under allowlist and the excluded names under denylist.
 * - Shares the same "scope + policy" pattern as visibleTools (tool layer) and resolve (version layer).
 */
import type { Policy } from "./types.ts"
import { defaultPolicy } from "./types.ts"

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

/** the derived scope: the names the child adds to what the parent decides. */
const narrowed = (parent: Policy, named: ReadonlyArray<string>): ReadonlyArray<string> => {
  const names = new Set(named)
  return parent.api.mode === "denylist"
    // The scope is what is EXCLUDED here, so narrowing means excluding MORE:
    // a child may not reach a tool the parent was denied. Intersect it as the
    // allowlist branch does and the child's exclusions are emptied of every
    // name it did not itself utter - a derived child reaching the parent's
    // blocked tool, and the policy reading as valid while it happens.
    ? [...new Set([...parent.api.scope, ...named])]
    // The scope is what is VISIBLE here, so narrowing means keeping less.
    : parent.api.scope.filter((name) => names.has(name))
}

/**
 * Derivation: the child sees no tool the parent did not, and inherits the rest.
 *
 * `named` is read against the parent's own mode, which is the only mode the
 * child can have - `mode` is inherited, never re-chosen.
 */
export const restrictPolicy = (
  parent: Policy,
  childScope: { readonly api?: ReadonlyArray<string>; readonly allowAgentConfig?: ReadonlyArray<string> }
): Policy => {
  const out = copy(parent)
  if (childScope.api !== undefined) {
    // readonly structure: narrow it through a mutable view
    ;(out.api as unknown as { scope: string[] }).scope = [...narrowed(parent, childScope.api)]
  }
  if (childScope.allowAgentConfig !== undefined) {
    const allowed = new Set(childScope.allowAgentConfig)
    ;(out as unknown as { allowAgentConfig: string[] }).allowAgentConfig = parent.allowAgentConfig.filter((path) => allowed.has(path))
  }
  return out
}

/**
 * Convenience: a base policy from the defaults, with whole keys replaced.
 *
 * Every key is replaced the same way, so there is one rule to learn. Merging
 * `compat` field-wise instead is what the spread used to look like it did and
 * did not - the trailing spread put the caller's partial object back over the
 * merge - and a second, field-wise override already exists for the case that
 * wants one: `mergePolicy`, whose whitelist says which paths may move.
 */
export const policy = (overrides: Partial<Policy>): Policy => ({ ...defaultPolicy, ...overrides })
