import type { PluginLifecycle } from "./lifecycle.ts"
import { matchHostOperation } from "./operation-match.ts"
import { runHostOperation } from "./operation-run.ts"
import { messageOf } from "@effect-agent/effect-interface"
import { json } from "./response.ts"

/**
 * The `/-/planes` control surface is the executor of the declared host
 * operations (operation-table.ts) — the path shapes live there, not here.
 * Existing control paths and success payloads remain unchanged.
 */
export const controlRequest = async (
  request: Request, path: string, lifecycle: PluginLifecycle,
): Promise<Response | undefined> => {
  const matched = matchHostOperation(request.method, path)
  if (matched === undefined) return undefined
  try {
    return json(await runHostOperation(matched.operation, matched.params, lifecycle))
  } catch (error) {
    return json({ ok: false, detail: `control error: ${messageOf(error)}` }, 502)
  }
}
