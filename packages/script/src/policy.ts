import type { Policy } from "./types.ts"
import { defaultPolicy } from "./types.ts"

const copy = (policy: Policy): Policy => JSON.parse(JSON.stringify(policy)) as Policy

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

export const mergePolicy = (system: Policy, agent: Partial<Policy>): Policy => {
  const out = copy(system)
  for (const path of system.allowAgentConfig) {
    const value = getPath(agent, path)
    if (value !== undefined) setPath(out, path, value)
  }
  return out
}

const narrowed = (parent: Policy, named: ReadonlyArray<string>): ReadonlyArray<string> => {
  const names = new Set(named)
  return parent.api.mode === "denylist"
    ? [...new Set([...parent.api.scope, ...named])]
    : parent.api.scope.filter((name) => names.has(name))
}

export const restrictPolicy = (
  parent: Policy,
  childScope: { readonly api?: ReadonlyArray<string>; readonly allowAgentConfig?: ReadonlyArray<string> }
): Policy => {
  const out = copy(parent)
  if (childScope.api !== undefined) {
    ;(out.api as unknown as { scope: string[] }).scope = [...narrowed(parent, childScope.api)]
  }
  if (childScope.allowAgentConfig !== undefined) {
    const allowed = new Set(childScope.allowAgentConfig)
    ;(out as unknown as { allowAgentConfig: string[] }).allowAgentConfig = parent.allowAgentConfig.filter((path) => allowed.has(path))
  }
  return out
}

export const policy = (overrides: Partial<Policy>): Policy => ({ ...defaultPolicy, ...overrides })
