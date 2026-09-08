import { json, param, readBody, type Controller } from "../http/protocol.ts"

export const launchers: Controller = async (request, { pathname, searchParams }, { store }) => {
  const { launchers, seed: seedLauncher, persist: persistLaunchers } = store
  if (pathname === "/api/launchers" && request.method === "GET") return json({ ok: true, launchers })
  if (pathname === "/api/launchers" && request.method === "POST") {
    const body = await readBody(request)
    const kind = typeof body.kind === "string" ? body.kind : undefined
    const label = typeof body.label === "string" ? body.label : undefined
    if (kind === undefined || label === undefined || kind.length === 0 || label.length === 0) return json({ ok: false, detail: "kind and label required" }, 400)
    const cfg = typeof body.config === "object" && body.config !== null ? body.config : undefined
    seedLauncher(kind, label, cfg)
    persistLaunchers()
    return json({ ok: true, launchers })
  }
  const launcherLabel = param(pathname, "/api/launchers/:label")
  if (launcherLabel !== undefined && request.method === "DELETE") {
    const kind = searchParams.get("kind")
    const idx = launchers.findIndex((l) => l.label === launcherLabel && (kind === null || l.kind === kind))
    if (idx === -1) return json({ ok: false, detail: "launcher not found" }, 404)
    const removed = launchers.splice(idx, 1)[0]!
    persistLaunchers()
    return json({ ok: true, removed })
  }
}
