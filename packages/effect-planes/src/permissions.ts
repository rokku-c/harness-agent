import type { PlaneScope } from "./types.ts"

export const makePermissions = () => {
  const grants = new Set<string>()
  const grantKey = (from: string, to: string, scope: PlaneScope) => `${from}>${to}:${scope}`
  const granted = (from: string, to: string, scope: PlaneScope) => grants.has(grantKey(from, to, scope))
  const can = (caller: string, to: string, scope: PlaneScope) => caller === to || granted(caller, to, scope)
  const require = (caller: string, to: string, scope: PlaneScope) => {
    if (!can(caller, to, scope)) throw new Error(`planes: denied — ${caller} cannot ${scope} ${to}`)
  }
  return {
    grant: (from: string, to: string, scopes: readonly PlaneScope[]) => scopes.forEach((s) => grants.add(grantKey(from, to, s))),
    revoke: (from: string, to: string, scopes: readonly PlaneScope[]) => scopes.forEach((s) => grants.delete(grantKey(from, to, s))),
    can,
    require,
  }
}
