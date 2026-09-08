import { json, param, readBody, type Controller } from "../http/protocol.ts"

export const turns: Controller = async (request, { pathname }, domain) => {
  const { deck, sessionGateway, lastTurn } = domain
  const historyId = param(pathname, "/api/session/:id/history")
  if (historyId !== undefined && request.method === "GET") {
    const gateway = sessionGateway(historyId)
    const turns = await gateway?.history?.(historyId) ?? []
    const consent = (deck.consent.mapping().get(historyId) ?? []).slice().reverse()
    return json({ ok: true, sessionId: historyId, turns, consent })
  }
  const sendId = param(pathname, "/api/session/:id/send")
  const retryId = param(pathname, "/api/session/:id/retry")
  const id = sendId ?? retryId
  if (id === undefined || request.method !== "POST") return
  const retry = retryId !== undefined
  const body = retry ? {} : await readBody(request)
  const text = retry ? lastTurn.get(id) : typeof body.text === "string" ? body.text : ""
  if (text === undefined) return json({ ok: false, detail: "no pending turn to retry" }, 404)
  const gateway = sessionGateway(id)
  if (!gateway) return json({ ok: false, detail: "unknown session" }, 404)
  if (deck.sessions().find(s => s.sessionId === id)?.status === "running") {
    return json({ ok: false, detail: "session busy: " + id }, 409)
  }
  const out = await gateway.send(id, text)
  if (!out.ok && out.awaiting?.length) lastTurn.set(id, text)
  else lastTurn.delete(id)
  return out.ok ? json({ ok: true, text: out.text, ...(retry ? { retried: true } : {}) })
    : json({ ok: false, detail: out.detail, ...(out.awaiting ? { awaiting: out.awaiting } : {}) }, 422)
}
