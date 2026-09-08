import { normalizeConfig } from "@effect-agent/agentdeck"
import { json, param, readBody, type Controller } from "../http/protocol.ts"

export const sessions: Controller = async (request, { pathname }, domain) => {
  const { deck, presets, gatewayFor, sessionPolicy, closeSession } = domain
  if (pathname === "/api/session" && request.method === "POST") {
    const body = await readBody(request)
    const kind = typeof body.kind === "string" ? body.kind : "demo"
    const known = presets.known(kind)
    if (!known && deck.get(kind) === undefined) {
      return json({ ok: false, detail: "unknown agent kind: " + kind + " (register a preset via POST /api/presets or use custom)" }, 404)
    }
    const rawConfig = typeof body.config === "object" && body.config !== null ? body.config : {}
    const config = normalizeConfig(kind as never, rawConfig)
    const wantedId = typeof body.sessionId === "string" ? body.sessionId : undefined
    if (wantedId !== undefined && deck.sessions().some((s) => s.sessionId === wantedId)) {
      return json({ ok: false, detail: "session already open: " + wantedId }, 409)
    }
    const gateway = gatewayFor(kind)
    const opened = await gateway.open({
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      config
    })
    const auto = config.consent?.autoApproveTools
    const mode = config.consent?.defaultDecision as "ask" | "allow" | "deny" | undefined
    if (auto !== undefined && auto.length > 0) {
      sessionPolicy.set(opened.sessionId, { auto: new Set(auto), mode: mode ?? "ask" })
    } else if (mode !== undefined && mode !== "ask") {
      sessionPolicy.set(opened.sessionId, { auto: new Set<string>(), mode })
    }
    return json({ ok: true, session: opened })
  }
  if (pathname === "/api/sessions/close-all" && request.method === "POST") {
    const sessions = deck.sessions()
    await Promise.all(sessions.map(s => closeSession(s.sessionId)))
    return json({ ok: true, closed: sessions.length })
  }
  const closeId = param(pathname, "/api/session/:id/close")
  if (closeId !== undefined && request.method === "POST") {
    await closeSession(closeId)
    return json({ ok: true })
  }
}
