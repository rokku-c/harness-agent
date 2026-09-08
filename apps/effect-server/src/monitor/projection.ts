import { fromCatalogEntry, interactivePage } from "@effect-agent/effect-parity"
import {
  makeRenderContract, contractToCompact, contractToJson, contractToToml, contractToTokenized,
  type EffectUiView,
} from "@effect-agent/effect-ui"
import type { AppEntry } from "@effect-agent/effect-apps"

export const parityOf = async (entry: AppEntry) => {
  const view = fromCatalogEntry(entry)
  return { ...view, state: await view.state }
}
export const projectView = async (entry: AppEntry, url: URL, richHtml?: string): Promise<Response> => {
  const view = await parityOf(entry)
  if (url.pathname.startsWith("/-/mirror/")) return Response.json(view)
  if (url.pathname.startsWith("/-/weblui/")) return new Response(interactivePage(view, {
    submitUrl: `/-/mirror/${encodeURIComponent(entry.appId)}/call`, richHtml,
  }), { headers: { "content-type": "text/html; charset=utf-8" } })
  if (!view.view) return Response.json({ ok: false, detail: "No authorized view" }, { status: 404 })
  const contract = makeRenderContract(view.view as EffectUiView, view.actions)
  const fmt = url.searchParams.get("fmt") ?? "json"
  const render = fmt === "toml" ? contractToToml : fmt === "compact" ? contractToCompact : fmt === "token" ? contractToTokenized : contractToJson
  return new Response(render(contract, view.state), { headers: {
    "content-type": fmt === "json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
  } })
}
