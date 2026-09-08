import { normalizeConfig, cliInvocation } from "@effect-agent/agentdeck"
import { CONFIG_SAMPLES } from "../domain/samples.ts"
import { json, type Controller } from "../http/protocol.ts"

export const overview: Controller = async (request, { pathname, searchParams }, { deck, store, presets }) => {
  const { launchers } = store
  if (pathname === "/api/config/samples" && request.method === "GET") return json({ ok: true, samples: CONFIG_SAMPLES })
  if (pathname === "/api/deck" && request.method === "GET") {
    const sessions = deck.sessions()
    const pending = deck.consent.pending()
    const mapping = [...deck.consent.mapping()].map(([sessionId, list]) => ({
      sessionId,
      entries: list.length,
      pending: list.filter((e) => e.decision === "pending").length,
      allowed: list.filter((e) => e.decision === "allow").length,
      denied: list.filter((e) => e.decision === "deny").length
    }))
    return json({
      kinds: [...deck.kinds()], launchers, sessions, pending, mapping,
      samples: CONFIG_SAMPLES
    })
  }if (pathname === "/api/config/preview" && request.method === "GET") {
    const kind = searchParams.get("kind") ?? "claude-code"
    const rawText = searchParams.get("raw")
    let raw: unknown = {}
    if (rawText !== null) { try { raw = JSON.parse(rawText) } catch { return json({ ok: false, detail: "raw must be JSON" }, 400) } }
    const unified = normalizeConfig(kind as never, raw)
    const invocation = presets.invocable().includes(kind) ? cliInvocation(unified, "<prompt>", presets.all()) : null
    return json({ ok: true, kind, unified, invocation })
  }
}
