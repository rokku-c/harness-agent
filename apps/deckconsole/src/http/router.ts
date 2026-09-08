import { sessions } from "../controller/sessions.ts"
import { turns } from "../controller/turns.ts"
import { launchers } from "../controller/launchers.ts"
import { presets } from "../controller/presets.ts"
import { consent } from "../controller/consent.ts"
import { overview } from "../controller/overview.ts"
import { assets } from "./assets.ts"
import { json } from "./protocol.ts"
import type { DeckDomain } from "../domain/deck.ts"

export const makeRouter = (domain: DeckDomain, basePath: string) => async (request: Request) => {
  const url = new URL(request.url)
  try {
    const asset = await assets(request, url.pathname, basePath)
    if (asset) return asset
    for (const controller of [sessions, turns, launchers, presets, consent, overview]) {
      const response = await controller(request, url, domain)
      if (response) return response
    }
    return json({ ok: false, detail: "not found " + request.method + " " + url.pathname }, 404)
  } catch (error) {
    return json({ ok: false, detail: error instanceof Error ? error.message : String(error) }, 500)
  }
}
