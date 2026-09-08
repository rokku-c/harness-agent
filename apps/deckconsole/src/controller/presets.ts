import { json, readBody, type Controller } from "../http/protocol.ts"

export const presets: Controller = async (request, { pathname }, { presets }) => {
  const { builtin: builtinCliPresets, dynamic: dynamicPresets } = presets
  if (pathname === "/api/presets" && request.method === "GET") {
    const presets = [
      ...Object.entries(builtinCliPresets).map(([kind, p]) => ({ kind, file: p.file, builtin: true })),
      ...[...dynamicPresets.entries()].map(([kind, p]) => ({ kind, file: p.file, args: [...p.args], builtin: false }))
    ]
    return json({ ok: true, presets })
  }
  if (pathname === "/api/presets" && request.method === "POST") {
    const body = await readBody(request)
    const kind = typeof body.kind === "string" ? body.kind : undefined
    const file = typeof body.file === "string" ? body.file : undefined
    const args = Array.isArray(body.args) ? body.args.map(String) : []
    if (kind === undefined || file === undefined || kind.length === 0) return json({ ok: false, detail: "kind and file required" }, 400)
    if (builtinCliPresets[kind] !== undefined || kind === "custom" || kind === "demo" || kind === "effect" || kind === "claude-cc" || kind === "effect-ops") {
      return json({ ok: false, detail: "kind already taken: " + kind }, 409)
    }
    dynamicPresets.set(kind, { file, args })
    return json({ ok: true, kind, file, args })
  }
}
