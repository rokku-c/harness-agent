import type { MeshAnnounce, MeshEntry, MeshNode } from "./types.ts"

export const makeStore = () => {
  const nodes = new Map<string, MeshEntry>()
  const announce = (a: MeshAnnounce) => {
    const key = `${a.ns}::${a.appId}`
    const entry: MeshEntry = { announce: a, registry: a.registry, endpoint: a.endpoint, eventsUrl: a.eventsUrl, remote: a.remote }
    nodes.set(key, entry)
    let left = false
    return { key, dispose: () => { if (!left) { left = true; if (nodes.get(key) === entry) nodes.delete(key) } } }
  }
  const list = (): readonly MeshNode[] => [...nodes.entries()].map(([key, e]) => ({ key, ns: e.announce.ns, appId: e.announce.appId, capabilities: e.announce.capabilities ?? [] }))
  return { nodes, announce, list }
}
