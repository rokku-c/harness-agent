import { json, param, readBody, type Controller } from "../http/protocol.ts"

export const consent: Controller = async (request, { pathname }, { deck }) => {
  if (pathname === "/api/consent" && request.method === "GET") return json({ ok: true, entries: deck.consent.entries() })
  if (pathname === "/api/consent/bulk" && request.method === "POST") {
    const body = await readBody(request)
    const allow = body.allow === true
    const pending = deck.consent.pending()
    let decided = 0
    for (const p of pending) if (deck.consent.resolve(p.callId, allow, "operator")) decided++
    return json({ ok: true, decided })
  }
  const callId = param(pathname, "/api/consent/:callId")
  if (callId !== undefined && request.method === "POST") {
    const body = await readBody(request)
    const allow = body.allow === true
    const done = deck.consent.resolve(callId, allow, "operator")
    return done ? json({ ok: true, allow }) : json({ ok: false, detail: "unknown or already decided call id" }, 404)
  }
}
