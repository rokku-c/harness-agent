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
    if (map.get(id) === value) map.delete(id)
  }
}
