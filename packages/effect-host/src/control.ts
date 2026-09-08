import type { PluginLifecycle } from "./lifecycle.ts"
import { errorDetail, json } from "./response.ts"

/** Existing control paths and success payloads remain unchanged. */
export const controlRequest = async (
  request: Request, path: string, lifecycle: PluginLifecycle,
): Promise<Response | undefined> => {
  if (path === "/-/planes" && request.method === "GET") return json(lifecycle.list())
  const control = path.match(/^\/-\/planes\/([^/]+)\/(enable|disable)$/)
  const deleted = path.match(/^\/-\/planes\/([^/]+)$/)
  try {
    if (control !== null && request.method === "POST") {
      const [, id, action] = control
      const ok = action === "enable" ? await lifecycle.enable(id) : await lifecycle.disable(id)
      return json({ ok, id, enabled: lifecycle.isEnabled(id) })
    }
    if (deleted !== null && request.method === "DELETE") {
      return json({ ok: await lifecycle.unregister(deleted[1]) })
    }
  } catch (error) {
    return json({ ok: false, detail: `control error: ${errorDetail(error)}` }, 502)
  }
  return undefined
}
