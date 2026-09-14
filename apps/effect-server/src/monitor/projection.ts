/**
 * The agent's-eye read of one app: its declared view, its live state, and the
 * actions it authorises — answered as data, in five notations.
 *
 * It used to answer a sixth way as well: an HTML page with one form per action,
 * the same view drawn a second time with its own hand-picked colours. That page
 * is gone. A person reads a canvas on the console, and this plane is what an
 * agent and a program read — `json`/`toml`/`compact`/`token` are notations of one
 * contract, not renderings of one, so they stay.
 */

import { fromCatalogEntry } from "@effect-agent/effect-parity"
import {
  makeRenderContract, contractToCompact, contractToJson, contractToToml, contractToTokenized,
  type EffectUiView,
} from "@effect-agent/effect-ui"
import type { AppEntry } from "@effect-agent/effect-apps"

export const parityOf = async (entry: AppEntry) => {
  const view = fromCatalogEntry(entry)
  return { ...view, state: await view.state }
}
export const projectView = async (entry: AppEntry, url: URL): Promise<Response> => {
  const view = await parityOf(entry)
  if (url.pathname.startsWith("/-/mirror/")) return Response.json(view)
  if (!view.view) return Response.json({ ok: false, detail: "No authorized view" }, { status: 404 })
  const contract = makeRenderContract(view.view as EffectUiView, view.actions)
  const fmt = url.searchParams.get("fmt") ?? "json"
  const render = fmt === "toml" ? contractToToml : fmt === "compact" ? contractToCompact : fmt === "token" ? contractToTokenized : contractToJson
  return new Response(render(contract, view.state), { headers: {
    "content-type": fmt === "json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
  } })
}
